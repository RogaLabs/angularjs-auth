'use strict';
(function() {
  angular.module('willcrisis.angular-auth', ['ngRoute', 'ui.router', 'angular-storage'])
  .provider('authConf', [function () {
    var options = {
      loginState: 'login',
      endpointUrl: '',
      logoutEndpointUrl: null,
      usernameProperty: 'username',
      tokenProperty: 'access_token',
      rolesProperty: 'roles',
      refreshTokenProperty: 'refresh_token',
      tokenTypeProperty: 'token_type',
      functionIfDenied: function(toState) {
        $state.go(options.loginState);
      },
      functionIfAuthenticated: function(data) {

      },
      setLoginState: function (state) {
        options.loginState = state;
      },
      setEndpointUrl: function (url) {
        options.endpointUrl = url;
      },
      setFunctionIfDenied: function(functionIfDenied) {
        options.functionIfDenied = functionIfDenied;
      },
      setLogoutEndpointUrl: function(logoutEndpointUrl) {
        options.logoutEndpointUrl = logoutEndpointUrl;
      },
      setUsernameProperty: function(property) {
          options.usernameProperty = property;
      },
      setTokenProperty: function(property) {
          options.tokenProperty = property;
      },
      setRolesProperty: function(property) {
          options.rolesProperty = property;
      },
      setRefreshTokenProperty: function(property) {
          options.refreshTokenProperty = property;
      },
      setTokenTypeProperty: function(property) {
          options.tokenTypeProperty = property;
      },
      setFunctionIfAuthenticated: function(functionIfAuthenticated) {
          options.functionIfAuthenticated = functionIfAuthenticated;
      }
    };

    this.$get = [function () {
      if (!options) {
        throw new Error('Não foi possível carregar as configurações.');
      }
      return options;
    }];
  }])
  .service('auth', ['$rootScope', 'store', '$http', 'authConf', function ($rootScope, store, $http, authConf) {
    this.username = null;
    this.roles = null;
    this.token = null;
    this.refreshToken = null;
    this.tokenType = null;
    this.loggedIn = false;

    var service = this;

    this.broadcast = function () {
      $rootScope.$broadcast('userChange');
    };

    this.login = function (username, password) {
      var data = {username: username, password: password};
      return Promise.race([
        $http.post(authConf.endpointUrl, data)
          .then(
            function (result) {
              service.authenticate(result.data);
              return service;
            },
            function (error) {
              throw error;
            }
          )
      ]);
    };

    this.authenticate = function (data) {
      setData(service, data);
      $http.defaults.headers.common.Authorization = (this.tokenType + " " + this.token).trim();
      authConf.functionIfAuthenticated(data);
      store.set('auth', data);
    };

    this.logout = function () {
      setData(service, {});
      $http.defaults.headers.common.Authorization = null;
      store.remove('auth');
      if (authConf.logoutEndpointUrl) {
          return $http.get(authConf.logoutEndpointUrl);
      }
    };

    this.hasRole = function (role) {
      if (!this.roles) {
        return false;
      }
      return this.roles.indexOf(role) > -1;
    };

    this.hasAllRoles = function (roles) {
      if (!this.roles) {
        return false;
      }
      for (var i = 0; i < roles.length; i++) {
        if (!this.hasRole(roles[i])) {
          return false;
        }
      }
      return true;
    };

    this.hasAnyRole = function (roles) {
      if (!this.roles) {
        return false;
      }
      for (var i = 0; i < roles.length; i++) {
        if (this.hasRole(roles[i])) {
          return true;
        }
      }
      return false;
    };

    this.canAccess = function (state) {
      if (!state) {
        return true;
      }
      if (state.auth === undefined) {
        return true;
      } else if (state.auth.constructor == Array) {
        if (state.requireAll) {
          return this.hasAllRoles(state.auth);
        } else {
          return this.hasAnyRole(state.auth);
        }
      } else {
        return state.auth === this.loggedIn
      }
    };

    function setData(service, response) {
      service.username = response[authConf.usernameProperty];
      service.token = response[authConf.tokenProperty];
      service.roles = response[authConf.rolesProperty];
      service.refreshToken = response[authConf.refreshTokenProperty];
      service.tokenType = response[authConf.tokenTypeProperty];
      service.loggedIn = !!response[authConf.tokenProperty];
    }
  }])
  .directive('authUsername', ['auth', function (auth) {
    return {
      restrict: 'E',
      template: '{{username}}',
      controller: ['$scope', function($scope) {
          $scope.username = auth.username;
      }]
    }
  }])
  .directive('authLoggedIn', ['auth', 'ngIfDirective', function (auth, ngIfDirective) {
    var ngIf = ngIfDirective[0];
    return {
      restrict: 'AE',
      transclude: ngIf.transclude,
      priority: ngIf.priority - 1,
      terminal: ngIf.terminal,
      link: function (scope, element, attrs) {
        attrs.ngIf = function() {
          return auth.loggedIn;
        };
        ngIf.link.apply(ngIf, arguments);
      }
    }
  }])
  .directive('authNotLoggedIn', ['auth', 'ngIfDirective', function (auth, ngIfDirective) {
    var ngIf = ngIfDirective[0];
    return {
      restrict: 'AE',
      transclude: ngIf.transclude,
      priority: ngIf.priority - 1,
      terminal: ngIf.terminal,
      link: function (scope, element, attrs) {
        attrs.ngIf = function() {
          return !auth.loggedIn;
        };
        ngIf.link.apply(ngIf, arguments);
      }
    }
  }])
  .directive('authHasRole', ['auth', 'ngIfDirective', function (auth, ngIfDirective) {
    var ngIf = ngIfDirective[0];
    return {
      restrict: 'AE',
      transclude: ngIf.transclude,
      priority: ngIf.priority - 1,
      terminal: ngIf.terminal,
      scope: {
        role: '@'
      },
      link: function (scope, element, attrs) {
        var value = scope.role || attrs.authHasRole;
        if (!value) {
          throw new Error('auth-has-role: É necessário informar uma Role');
        }
        attrs.ngIf = function() {
          return auth.hasRole(value);
        };
        ngIf.link.apply(ngIf, arguments);
      }
    }
  }])
  .directive('authHasAnyRole', ['auth', 'ngIfDirective', function (auth, ngIfDirective) {
    var ngIf = ngIfDirective[0];
    return {
      restrict: 'AE',
      transclude: ngIf.transclude,
      priority: ngIf.priority - 1,
      terminal: ngIf.terminal,
      scope: {
        roles: '@'
      },
      link: function (scope, element, attrs) {
        var value = scope.roles ? scope.roles.split(',') : attrs.authHasAnyRole ? attrs.authHasAnyRole.split(',') : null;
        if (!value) {
          throw new Error('auth-has-any-role: É necessário informar pelo menos uma Role');
        }
        attrs.ngIf = function() {
          return auth.hasAnyRole(value);
        };
        ngIf.link.apply(ngIf, arguments);
      }
    }
  }])
  .directive('authHasAllRoles', ['auth', 'ngIfDirective', function (auth, ngIfDirective) {
    var ngIf = ngIfDirective[0];
    return {
      restrict: 'AE',
      transclude: ngIf.transclude,
      priority: ngIf.priority - 1,
      terminal: ngIf.terminal,
      scope: {
        roles: '@'
      },
      link: function (scope, element, attrs) {
        var value = scope.roles ? scope.roles.split(',') : attrs.authHasAllRoles ? attrs.authHasAllRoles.split(',') : null;
        if (!value) {
          throw new Error('auth-has-all-roles: É necessário informar pelo menos uma Role');
        }
        attrs.ngIf = function() {
          return auth.hasAllRoles(value);
        };
        ngIf.link.apply(ngIf, arguments);
      }
    }
  }])
  .run(['$rootScope', '$state', 'auth', 'authConf', function($rootScope, $state, auth, authConf) {
    $rootScope.$on('$stateChangeStart', function (event, toState) {
      if (!auth.canAccess(toState)) {
        event.preventDefault();
        authConf.functionIfDenied(toState);
      }
    });

    var response = store.get('auth') || {};
    if (response) {
      auth.authenticate(response);
    }
  }]);
})();
