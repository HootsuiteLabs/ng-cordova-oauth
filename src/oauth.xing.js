(function() {
  'use strict';

  angular.module('oauth.xing', ['oauth.utils'])
    .factory('$ngCordovaXing', xing);

  function xing($q, $http, $cordovaOauthUtility) {
    return { signin: oauthXing };

    /*
     * Sign into the Xing service
     * Note that this service requires jsSHA for generating HMAC-SHA1 Oauth 1.0 signatures
     *
     * @param    string clientId
     * @param    string clientSecret
     * @param    object options
     * @return   promise
     */
    function oauthXing(clientId, clientSecret, options) {
      var deferred = $q.defer();
      if(window.cordova) {
        if($cordovaOauthUtility.isInAppBrowserInstalled()) {
          var redirect_uri = 'http://localhost/callback';
          if(options !== undefined) {
            if(options.hasOwnProperty('redirect_uri')) {
              redirect_uri = options.redirect_uri;
            }
          }

          if(typeof jsSHA !== 'undefined') {
            var oauthObject = {
              oauth_consumer_key: clientId,
              oauth_nonce: $cordovaOauthUtility.createNonce(10),
              oauth_signature_method: 'HMAC-SHA1',
              oauth_timestamp: Math.round((new Date()).getTime() / 1000.0),
              oauth_version: '1.0'
            };
            var signatureObj = $cordovaOauthUtility.createSignature('POST', 'https://api.xing.com/v1/request_token', oauthObject,  { oauth_callback: redirect_uri }, clientSecret);
            $http({
              method: 'post',
              url: 'https://api.xing.com/v1/request_token',
              headers: {
                  'Authorization': signatureObj.authorization_header,
                  'Content-Type': 'application/x-www-form-urlencoded'
              },
              data: 'oauth_callback=' + encodeURIComponent(redirect_uri)
            })
              .then(function(requestTokenResult) {
                var requestTokenParameters = (requestTokenResult).split('&');
                var parameterMap = {};
                for(var i = 0; i < requestTokenParameters.length; i++) {
                  parameterMap[requestTokenParameters[i].split('=')[0]] = requestTokenParameters[i].split('=')[1];
                }
                if(parameterMap.hasOwnProperty('oauth_token') === false) {
                  deferred.reject('Oauth request token was not received');
                }
                var oauthTokenSecret = parameterMap.oauth_token_secret;
                var browserRef = window.cordova.InAppBrowser.open('https://api.xing.com/v1/authorize?oauth_token=' + parameterMap.oauth_token, '_blank', 'location=no,clearsessioncache=yes,clearcache=yes');
                browserRef.addEventListener('loadstart', function(event) {
                  if((event.url).indexOf(redirect_uri) === 0) {
                    var callbackResponse = (event.url).split('?')[1];
                    var responseParameters = (callbackResponse).split('&');
                    var parameterMap = {};
                    for(var i = 0; i < responseParameters.length; i++) {
                      parameterMap[responseParameters[i].split('=')[0]] = responseParameters[i].split('=')[1];
                    }
                    if(parameterMap.hasOwnProperty('oauth_verifier') === false) {
                      deferred.reject('Browser authentication failed to complete.  No oauth_verifier was returned');
                    }
                    delete oauthObject.oauth_signature;
                    oauthObject.oauth_token = parameterMap.oauth_token;
                    var signatureObj = $cordovaOauthUtility.createSignature('POST', 'https://api.xing.com/v1/access_token', oauthObject,  { oauth_verifier: parameterMap.oauth_verifier }, clientSecret, oauthTokenSecret);
                    $http({
                      method: 'post',
                      url: 'https://api.xing.com/v1/access_token',
                      headers: {
                          'Authorization': signatureObj.authorization_header
                      },
                      params: {
                          'oauth_verifier': parameterMap.oauth_verifier
                      }
                    })
                      .then(function(result) {
                        var accessTokenParameters = result.split('&');
                        var parameterMap = {};
                        for(var i = 0; i < accessTokenParameters.length; i++) {
                          parameterMap[accessTokenParameters[i].split('=')[0]] = accessTokenParameters[i].split('=')[1];
                        }
                        if(parameterMap.hasOwnProperty('oauth_token_secret') === false) {
                          deferred.reject('Oauth access token was not received');
                        }
                        deferred.resolve(parameterMap);
                      })
                      .catch(function(error) {
                        deferred.reject(error);
                      })
                      .finally(function() {
                        setTimeout(function() {
                            browserRef.close();
                        }, 10);
                      });
                  }
                });
                browserRef.addEventListener('exit', function(event) {
                  deferred.reject('The sign in flow was canceled');
                });
              })
              .catch(function(error) {
                deferred.reject(error);
              });
          } else {
              deferred.reject('Missing jsSHA JavaScript library');
          }
        } else {
            deferred.reject('Could not find InAppBrowser plugin');
        }
      } else {
        deferred.reject('Cannot authenticate via a web browser');
      }

      return deferred.promise;
    }
  }

  xing.$inject = ['$q', '$http', '$cordovaOauthUtility'];
})();
