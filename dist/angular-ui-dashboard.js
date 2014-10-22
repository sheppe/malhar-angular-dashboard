/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

angular.module('ui.dashboard', ['ui.bootstrap', 'shapeshift']);

angular.module('ui.dashboard')
    .directive('dashboard', ['WidgetModel', 'WidgetDefCollection', '$modal', 'DashboardState', function (WidgetModel, WidgetDefCollection, $modal, DashboardState) {
        return {
            restrict: 'A',
            templateUrl: function(element, attr) {
                return attr.templateUrl ? attr.templateUrl : 'template/dashboard.html';
            },
            scope: true,

            controller: ['$scope',function ($scope) {
                $scope.sortableOptions = {
                    handle: '.widget-header'
                };

                $scope.$on('ss-rearranged', function(e){
                    $scope.saveDashboard();
                });
            }],
            link: function (scope, element, attrs) {
                // default dashboard options
                var defaults = {
                    stringifyStorage: true
                };

                scope.options = scope.$eval(attrs.dashboard);

                // from dashboard="options"
                angular.extend(defaults, scope.options);
                angular.extend(scope.options, defaults);

                // Save default widget config for reset
                scope.defaultWidgets = scope.options.defaultWidgets;

                //scope.widgetDefs = scope.options.widgetDefinitions;
                scope.widgetDefs = new WidgetDefCollection(scope.options.widgetDefinitions);
                var count = 1;

                // Instantiate new instance of dashboard state
                scope.dashboardState = new DashboardState(
                    scope.options.storage,
                    scope.options.storageId,
                    scope.options.storageHash,
                    scope.widgetDefs,
                    scope.options.stringifyStorage
                );

                /**
                 * Instantiates a new widget on the dashboard
                 * @param {Object} widgetToInstantiate The definition object of the widget to be instantiated
                 */
                scope.addWidget = function (widgetToInstantiate, doNotSave) {
                    var defaultWidgetDefinition = scope.widgetDefs.getByName(widgetToInstantiate.name);
                    if (!defaultWidgetDefinition) {
                        throw 'Widget ' + widgetToInstantiate.name + ' is not found.';
                    }

                    // Determine the title for the new widget
                    var title;
                    if (widgetToInstantiate.title) {
                        title = widgetToInstantiate.title;
                    } else if (defaultWidgetDefinition.title) {
                        title = defaultWidgetDefinition.title;
                    } else {
                        title = 'Widget ' + count++;
                    }

                    // Deep extend a new object for instantiation
                    widgetToInstantiate = jQuery.extend(true, {}, defaultWidgetDefinition, widgetToInstantiate);

                    // Make sure there's a dataModelOptions value, even if it's an empty array.
                    /*** Widget-specific data values must be added to the dataModelOptions hash, as coded below ***/
                    if(!widgetToInstantiate.dataModelOptions && (widgetToInstantiate.dataUrl || widgetToInstantiate.dataTime)){
                        widgetToInstantiate.dataModelOptions = {
                            dataUrl: widgetToInstantiate.dataUrl,
                            dataTime: widgetToInstantiate.dataTime
                        };
                    }

                    // Instantiation
                    var widget = new WidgetModel(widgetToInstantiate, {
                        title: title
                    });

                    scope.widgets.push(widget);
                    if (!doNotSave) {
                        scope.saveDashboard();
                    }
                };

                /**
                 * Removes a widget instance from the dashboard
                 * @param  {Object} widget The widget instance object (not a definition object)
                 */
                scope.removeWidget = function (widget) {
                    scope.widgets.splice(_.indexOf(scope.widgets, widget), 1);
                    scope.saveDashboard();
                };

                /**
                 * Opens a dialog for setting and changing widget properties
                 * @param  {Object} widget The widget instance object
                 */
                scope.openWidgetDialog = function (widget) {
                    var options = widget.editModalOptions;

                    // use default options when none are supplied by widget
                    if (!options) {
                        options = {
                            templateUrl: 'template/widget-template.html',
                            resolve: {
                                widget: function () {
                                    return widget;
                                },
                                optionsTemplateUrl: function () {
                                    return scope.options.optionsTemplateUrl;
                                }
                            },
                            controller: 'WidgetDialogCtrl'
                        };
                    }
                    var modalInstance = $modal.open(options);

                    // Set resolve and reject callbacks for the result promise
                    modalInstance.result.then(
                        function (result) {
                            console.log('widget dialog closed');
                            console.log('result: ', result);
                            widget.title = result.title;
                            //AW Persist title change from options editor
                            scope.$emit('widgetChanged', widget);
                        },
                        function (reason) {
                            console.log('widget dialog dismissed: ', reason);

                        }
                    );

                };

                /**
                 * Remove all widget instances from dashboard
                 */
                scope.clear = function (doNotSave) {
                    scope.widgets = [];
                    if (doNotSave === true) {
                        return;
                    }
                    scope.saveDashboard();
                };

                /**
                 * Used for preventing default on click event
                 * @param {Object} event     A click event
                 * @param {Object} widgetDef A widget definition object
                 */
                scope.addWidgetInternal = function (event, widgetDef) {
                    event.preventDefault();
                    scope.addWidget(widgetDef);
                };

                /**
                 * Uses dashboardState service to save state
                 */
                scope.saveDashboard = function (force) {
                    if (!scope.options.explicitSave) {
                        scope.dashboardState.save(scope.widgets);
                    } else {
                        if (typeof scope.options.unsavedChangeCount !== 'number') {
                            scope.options.unsavedChangeCount = 0;
                        }
                        if (force) {
                            scope.options.unsavedChangeCount = 0;
                            scope.dashboardState.save(scope.widgets);

                        } else {
                            ++scope.options.unsavedChangeCount;
                        }
                    }
                };

                /**
                 * Wraps saveDashboard for external use.
                 */
                scope.externalSaveDashboard = function() {
                    scope.saveDashboard(true);
                };

                /**
                 * Clears current dash and instantiates widget definitions
                 * @param  {Array} widgets Array of definition objects
                 */
                scope.loadWidgets = function (widgets) {
                    // AW dashboards are continuously saved today (no "save" button).
                    //scope.defaultWidgets = widgets;
                    scope.savedWidgetDefs = widgets;
                    scope.clear(true);
                    _.each(widgets, function (widgetDef) {
                        scope.addWidget(widgetDef, true);
                    });
                };

                /**
                 * Resets widget instances to default config
                 * @return {[type]} [description]
                 */
                scope.resetWidgetsToDefault = function () {
                    scope.loadWidgets(scope.defaultWidgets);
                    scope.saveDashboard();
                };

                scope.loadDashboard = function(){
                    // Update the storageId in case it's changed between loads.
                    scope.dashboardState.id = scope.options.storageId;

                    var savedWidgetDefs = scope.dashboardState.load();

                    if (savedWidgetDefs instanceof Array) {
                        handleStateLoad(savedWidgetDefs);
                    }
                    else if (savedWidgetDefs && typeof savedWidgetDefs === 'object' && typeof savedWidgetDefs.then === 'function') {
                        savedWidgetDefs.then(handleStateLoad, handleStateLoad);
                    }
                    else {
                        handleStateLoad();
                    }

                    // Success handler
                    function handleStateLoad(saved) {
                        scope.options.unsavedChangeCount = 0;
                        if (saved && saved.length) {
                            scope.loadWidgets(saved);
                        } else if (scope.defaultWidgets) {
                            scope.loadWidgets(scope.defaultWidgets);
                        } else {
                            scope.clear(true);
                        }
                    }
                };

                //*** Commented out the below to force manual loading of dashboards. The automatic loading
                //*** was causing issues in some cases.
                // Set default widgets array
                //scope.loadDashboard();

                // expose functionality externally
                // functions are appended to the provided dashboard options
                scope.options.addWidget = scope.addWidget;
                scope.options.loadWidgets = scope.loadWidgets;
                scope.options.saveDashboard = scope.externalSaveDashboard;
                scope.options.loadDashboard = scope.loadDashboard;
                scope.options.clear = scope.clear;

                // save state
                scope.$on('widgetChanged', function (event) {
                    event.stopPropagation();
                    $(window).trigger('resize');
                    scope.saveDashboard();
                });
            }
        };
    }]);

/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .directive('dashboardLayouts', ['LayoutStorage', '$timeout', '$modal', function(LayoutStorage, $timeout, $modal) {
    return {
      scope: true,
      templateUrl: function(element, attr) {
        return attr.templateUrl ? attr.templateUrl : 'template/dashboard-layouts.html';
      },
      link: function(scope, element, attrs) {

        scope.options = scope.$eval(attrs.dashboardLayouts);

        var layoutStorage = new LayoutStorage(scope.options);

        scope.layouts = layoutStorage.layouts;

        scope.createNewLayout = function() {
          var newLayout = { title: 'Custom', defaultWidgets: scope.options.defaultWidgets || [] };
          layoutStorage.add(newLayout);
          scope.makeLayoutActive(newLayout);
          layoutStorage.save();
          return newLayout;
        };

        scope.removeLayout = function(layout) {
          layoutStorage.remove(layout);
          layoutStorage.save();
        };

        scope.makeLayoutActive = function(layout) {

          var current = layoutStorage.getActiveLayout();

          if (current && current.dashboard.unsavedChangeCount) {
            var modalInstance = $modal.open({
              templateUrl: 'template/save-changes-modal.html',
              resolve: {
                layout: function () {
                  return layout;
                }
              },
              controller: 'SaveChangesModalCtrl'
            });

            // Set resolve and reject callbacks for the result promise
            modalInstance.result.then(
              function () {
                current.dashboard.saveDashboard();
                scope._makeLayoutActive(layout);
              },
              function () {
                scope._makeLayoutActive(layout);
              }
            );
          }

          else {
            scope._makeLayoutActive(layout);
          }
          
        };

        scope._makeLayoutActive = function(layout) {
          angular.forEach(scope.layouts, function(l) {
            if (l !== layout) {
              l.active = false;
            } else {
              l.active = true;
            }
          });
          layoutStorage.save();
        };

        scope.isActive = function(layout) {
          return !! layout.active;
        };

        scope.editTitle = function (layout) {
          var input = element.find('input[data-layout="' + layout.id + '"]');
          layout.editingTitle = true;

          $timeout(function() {
            input.focus()[0].setSelectionRange(0, 9999);
          });
        };

        // saves whatever is in the title input as the new title
        scope.saveTitleEdit = function (layout) {
          layout.editingTitle = false;
          layoutStorage.save();
        };

        scope.options.saveLayouts = function() {
          layoutStorage.save(true);
        };
        scope.options.addWidget = function() {
          var layout = layoutStorage.getActiveLayout();
          if (layout) {
            layout.dashboard.addWidget.apply(layout.dashboard, arguments);
          }
        };
        scope.options.loadWidgets = function() {
          var layout = layoutStorage.getActiveLayout();
          if (layout) {
            layout.dashboard.loadWidgets.apply(layout.dashboard, arguments);
          }
        };
        scope.options.saveDashboard = function() {
          var layout = layoutStorage.getActiveLayout();
          if (layout) {
            layout.dashboard.saveDashboard.apply(layout.dashboard, arguments);
          }
        };
      }
    };
  }]);
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
    .directive('widget', function () {

        return {

            controller: 'DashboardWidgetCtrl',

            link: function (scope) {

                var widget = scope.widget;
                // set up data source
                if (widget.dataModelType) {
                    var ds = new widget.dataModelType();
                    widget.dataModel = ds;
                    ds.setup(widget, scope);
                    ds.init();
                    scope.$on('$destroy', _.bind(ds.destroy,ds));
                }

                // Compile the widget template, emit add event
                scope.compileTemplate();
                scope.$emit('widgetAdded', widget);

            }

        };
    });
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .factory('LayoutStorage', function() {

    var noopStorage = {
      setItem: function() {

      },
      getItem: function() {

      },
      removeItem: function() {

      }
    };

    

    function LayoutStorage(options) {

      var defaults = {
        storage: noopStorage,
        storageHash: '',
        stringifyStorage: true
      };

      angular.extend(defaults, options);
      angular.extend(options, defaults);

      this.id = options.storageId;
      this.storage = options.storage;
      this.storageHash = options.storageHash;
      this.stringifyStorage = options.stringifyStorage;
      this.widgetDefinitions = options.widgetDefinitions;
      this.defaultLayouts = options.defaultLayouts;
      this.widgetButtons = options.widgetButtons;
      this.explicitSave = options.explicitSave;
      this.defaultWidgets = options.defaultWidgets;
      this.options = options;
      this.options.unsavedChangeCount = 0;

      this.layouts = [];
      this.states = {};
      this.load();
      this._ensureActiveLayout();
    }

    LayoutStorage.prototype = {

      add: function(layouts) {
        if ( !(layouts instanceof Array) ) {
          layouts = [layouts];
        }
        var self = this;
        angular.forEach(layouts, function(layout) {
          layout.dashboard = layout.dashboard || {};
          layout.dashboard.storage = self;
          layout.dashboard.storageId = layout.id = self._getLayoutId.call(self,layout);
          layout.dashboard.widgetDefinitions = self.widgetDefinitions;
          layout.dashboard.stringifyStorage = false;
          layout.dashboard.defaultWidgets = layout.defaultWidgets || self.defaultWidgets;
          layout.dashboard.widgetButtons = self.widgetButtons;
          layout.dashboard.explicitSave = self.explicitSave;
          self.layouts.push(layout);
        });
      },

      remove: function(layout) {
        var index = this.layouts.indexOf(layout);
        if (index >= 0) {
          this.layouts.splice(index, 1);
          delete this.states[layout.id];

          // check for active
          if (layout.active && this.layouts.length) {
            var nextActive = index > 0 ? index - 1 : 0;
            this.layouts[nextActive].active = true;
          }
        }
      },

      save: function() {

        var state = {
          layouts: this._serializeLayouts(),
          states: this.states,
          storageHash: this.storageHash
        };

        if (this.stringifyStorage) {
          state = JSON.stringify(state);
        }

        this.storage.setItem(this.id, state);
        this.options.unsavedChangeCount = 0;
      },

      load: function() {

        var serialized = this.storage.getItem(this.id);
        var self = this;

        this.clear();

        if (serialized) {
          
          // check for promise
          if (typeof serialized === 'object' && typeof serialized.then === 'function') {
            this._handleAsyncLoad(serialized);
          }
           else {
            this._handleSyncLoad(serialized);
          }

        }

        else {
          this._addDefaultLayouts();
        }
      },

      clear: function() {
        this.layouts = [];
        this.states = {};
      },

      setItem: function(id, value) {
        this.states[id] = value;
        this.save();
      },

      getItem: function(id) {
        return this.states[id];
      },

      removeItem: function(id) {
        delete this.states[id];
        this.save();
      },

      getActiveLayout: function() {
        var len = this.layouts.length;
        for (var i = 0; i < len; i++) {
          var layout = this.layouts[i];
          if (layout.active) {
            return layout;
          }
        }
        return false;
      },

      _addDefaultLayouts: function() {
        var self = this;
        angular.forEach(this.defaultLayouts, function(layout) {
          self.add(angular.extend({}, layout));
        });
      },

      _serializeLayouts: function() {
        var result = [];
        angular.forEach(this.layouts, function(l) {
          result.push({
            title: l.title,
            id: l.id,
            active: l.active,
            defaultWidgets: l.dashboard.defaultWidgets
          });
        });
        return result;
      },

      _handleSyncLoad: function(serialized) {
        
        var deserialized;

        if (this.stringifyStorage) {
          try {

            deserialized = JSON.parse(serialized);

          } catch (e) {
            this._addDefaultLayouts();
            return;
          }
        } else {

          deserialized = serialized;

        }

        if (this.storageHash !== deserialized.storageHash) {
          this._addDefaultLayouts();
          return;
        }
        this.states = deserialized.states;
        this.add(deserialized.layouts);
      },

      _handleAsyncLoad: function(promise) {
        var self = this;
        promise.then(
          angular.bind(self, this._handleSyncLoad),
          angular.bind(self, this._addDefaultLayouts)
        );
      },

      _ensureActiveLayout: function() {
        for (var i = 0; i < this.layouts.length; i++) {
          var layout = this.layouts[i];
          if (layout.active) {
            return;
          }
        }
        if (this.layouts[0]) {
          this.layouts[0].active = true;
        }
      },

      _getLayoutId: function(layout) {
        if (layout.id) {
          return layout.id;
        }
        var max = 0;
        for (var i = 0; i < this.layouts.length; i++) {
          var id = this.layouts[i].id;
          max = Math.max(max, id * 1);
        }
        return max + 1;
      }

    };
    return LayoutStorage;
  });
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .factory('DashboardState', ['$log', '$q', function ($log, $q) {
    function DashboardState(storage, id, hash, widgetDefinitions, stringify) {
      this.storage = storage;
      this.id = id;
      this.hash = hash;
      this.widgetDefinitions = widgetDefinitions;
      this.stringify = stringify;
    }

    DashboardState.prototype = {
      /**
       * Takes array of widget instance objects, serializes, 
       * and saves state.
       * 
       * @param  {Array} widgets  scope.widgets from dashboard directive
       * @return {Boolean}        true on success, false on failure
       */
      save: function (widgets) {
        
        if (!this.storage) {
          return true;
        }

        var serialized = _.map(widgets, function (widget) {
          var widgetObject = {
            title: widget.title,
            name: widget.name,
            style: widget.style,
            dataModelOptions: widget.dataModelOptions,
            storageHash: widget.storageHash,
            attrs: widget.attrs
          };

          return widgetObject;
        });

        var item = { widgets: serialized, hash: this.hash };

        if (this.stringify) {
          item = JSON.stringify(item);
        }

        this.storage.setItem(this.id, item);
        return true;
      },

      /**
       * Loads dashboard state from the storage object.
       * Can handle a synchronous response or a promise.
       * 
       * @return {Array|Promise} Array of widget definitions or a promise
       */
      load: function () {

        if (!this.storage) {
          return null;
        }

        var serialized;

        // try loading storage item
        serialized = this.storage.getItem( this.id );

        if (serialized) {
          // check for promise
          if (typeof serialized === 'object' && typeof serialized.then === 'function') {
            return this._handleAsyncLoad(serialized);
          }
          // otherwise handle synchronous load
          return this._handleSyncLoad(serialized);
        } else {
          return null;
        }
      },

      _handleSyncLoad: function(serialized) {

        var deserialized, result = [];

        if (!serialized) {
          return null;
        }

        if (this.stringify) {
          try { // to deserialize the string

            deserialized = JSON.parse(serialized);

          } catch (e) {

            // bad JSON, log a warning and return
            $log.warn('Serialized dashboard state was malformed and could not be parsed: ', serialized);
            return null;

          }
        }
        else {
          deserialized = serialized;
        }

        // check hash against current hash
        if (deserialized.hash !== this.hash) {

          $log.info('Serialized dashboard from storage was stale (old hash: ' + deserialized.hash + ', new hash: ' + this.hash + ')');
          this.storage.removeItem(this.id);
          return null;

        }

        // Cache widgets
        var savedWidgetDefs = deserialized.widgets;

        // instantiate widgets from stored data
        for (var i = 0; i < savedWidgetDefs.length; i++) {

          // deserialized object
          var savedWidgetDef = savedWidgetDefs[i];

          // widget definition to use
          var widgetDefinition = this.widgetDefinitions.getByName(savedWidgetDef.name);

          // check for no widget
          if (!widgetDefinition) {
            // no widget definition found, remove and return false
            $log.warn('Widget with name "' + savedWidgetDef.name + '" was not found in given widget definition objects');
            continue;
          }

          // check widget-specific storageHash
          if (widgetDefinition.hasOwnProperty('storageHash') && widgetDefinition.storageHash !== savedWidgetDef.storageHash) {
            // widget definition was found, but storageHash was stale, removing storage
            $log.info('Widget Definition Object with name "' + savedWidgetDef.name + '" was found ' +
              'but the storageHash property on the widget definition is different from that on the ' +
              'serialized widget loaded from storage. hash from storage: "' + savedWidgetDef.storageHash + '"' +
              ', hash from WDO: "' + widgetDefinition.storageHash + '"');
            continue;
          }

          // push instantiated widget to result array
          result.push(savedWidgetDef);
        }

        return result;
      },

      _handleAsyncLoad: function(promise) {
        var self = this;
        var deferred = $q.defer();
        promise.then(
          // success
          function(res) {
              var result = res[0].data ? self._handleSyncLoad(res[0].data) : self._handleSyncLoad(res);
            if (result) {
              deferred.resolve(result);
            } else {
              deferred.reject(result);
            }
          },
          // failure
          function(res) {
            deferred.reject(res);
          }
        );

        return deferred.promise;
      }

    };
    return DashboardState;
  }]);
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .factory('WidgetDataModel', function () {
    function WidgetDataModel() {
    }

    WidgetDataModel.prototype = {
      setup: function (widget, scope) {
        this.dataAttrName = widget.dataAttrName;
        this.dataModelOptions = widget.dataModelOptions;
        this.widgetScope = scope;
      },

      updateScope: function (data) {
        this.widgetScope.widgetData = data;
      },

      init: function () {
        // to be overridden by subclasses
      },

      destroy: function () {
        // to be overridden by subclasses
      }
    };

    return WidgetDataModel;
  });
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .factory('WidgetDefCollection', function () {
    function WidgetDefCollection(widgetDefs) {
      this.push.apply(this, widgetDefs);

      // build (name -> widget definition) map for widget lookup by name
      var map = {};
      _.each(widgetDefs, function (widgetDef) {
        map[widgetDef.name] = widgetDef;
      });
      this.map = map;
    }

    WidgetDefCollection.prototype = Object.create(Array.prototype);

    WidgetDefCollection.prototype.getByName = function (name) {
      return this.map[name];
    };

    return WidgetDefCollection;
  });
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
    .factory('WidgetModel', function () {
        // constructor for widget model instances
        function WidgetModel(Class, overrides) {
            var defaults = {
                title: 'Widget',
                name: Class.name,
                attrs: Class.attrs,
                dataAttrName: Class.dataAttrName,
                dataModelType: Class.dataModelType,
                //AW Need deep copy of options to support widget options editing
                dataModelOptions: Class.dataModelOptions,
                style: Class.style
            };
            overrides = overrides || {};
            angular.extend(this, angular.copy(defaults), overrides);
            this.style = this.style || { width: '33%', height: '240px' };
            this.setWidth(this.style.width || '33%');
            this.setHeight(this.style.height || '240px');

            if (Class.templateUrl) {
                this.templateUrl = Class.templateUrl;
            } else if (Class.template) {
                this.template = Class.template;
            } else {
                var directive = Class.directive || Class.name;
                this.directive = directive;
            }
        }

        WidgetModel.prototype = {
            // sets the width (and widthUnits)
            setWidth: function (width, units) {
                width = width.toString();
                units = units || width.replace(/^[-\.\d]+/, '') || '%';
                this.widthUnits = units;
                width = parseFloat(width);

                if (width < 0) {
                    return false;
                }

                if (units === '%') {
                    width = Math.min(100, width);
                    width = Math.max(0, width);
                }
                this.style.width = width + '' + units;

                return true;
            },
            // sets the height (and widthUnits)
            setHeight: function (height, units) {
                height = height.toString();
                units = units || height.replace(/^[-\.\d]+/, '') || 'px';
                this.heightUnits = units;
                height = parseFloat(height);

                if (height < 0) {
                    return false;
                }

                if (units === '%') {
                    height = Math.min(100, height);
                    height = Math.max(0, height);
                }
                this.style.height = height + '' + units;

                return true;
            }
        };

        return WidgetModel;
    });
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .controller('SaveChangesModalCtrl', ['$scope', '$modalInstance', 'layout', function ($scope, $modalInstance, layout) {
    
    // add layout to scope
    $scope.layout = layout;

    $scope.ok = function () {
      $modalInstance.close();
    };

    $scope.cancel = function () {
      $modalInstance.dismiss();
    };
  }]);
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
    .controller('DashboardWidgetCtrl', ['$scope', '$element', '$compile', '$window', '$timeout', function($scope, $element, $compile, $window, $timeout) {

        // Fills "container" with compiled view
        $scope.makeTemplateString = function() {

            var widget = $scope.widget;

            // First, build template string
            var templateString = '';

            if (widget.templateUrl) {

                // Use ng-include for templateUrl
                templateString = '<div ng-include="\'' + widget.templateUrl + '\'"></div>';

            } else if (widget.template) {

                // Direct string template
                templateString = widget.template;

            } else {

                // Assume attribute directive
                templateString = '<div ' + widget.directive;

                // Check if data attribute was specified
                if (widget.dataAttrName) {
                    widget.attrs = widget.attrs || {};
                    widget.attrs[widget.dataAttrName] = 'widgetData';
                }

                // Check for specified attributes
                if (widget.attrs) {

                    // First check directive name attr
                    if (widget.attrs[widget.directive]) {
                        templateString += '="' + widget.attrs[widget.directive] + '"';
                    }

                    // Add attributes
                    _.each(widget.attrs, function (value, attr) {

                        // make sure we aren't reusing directive attr
                        if (attr !== widget.directive) {
                            templateString += ' ' + attr + '="' + value + '"';
                        }

                    });
                }

                templateString += '></div>';
            }
            return templateString;
        };

        $scope.grabResizer = function (e) {

            var widget = $scope.widget;
            var widgetElm = $element.find('.widget');

            // ignore middle- and right-click
            if (e.which !== 1) {
                return;
            }

            e.stopPropagation();
            e.originalEvent.preventDefault();

            // get the starting horizontal position
            var initX = e.clientX;
            // console.log('initX', initX);

            // Get the current width of the widget and dashboard
            var pixelWidth = widgetElm.width();
            var pixelHeight = widgetElm.height();
            var widgetStyleWidth = widget.style.width;
            var widthUnits = widget.widthUnits;
            var unitWidth = parseFloat(widgetStyleWidth);

            // create marquee element for resize action
            var $marquee = angular.element('<div class="widget-resizer-marquee" style="height: ' + pixelHeight + 'px; width: ' + pixelWidth + 'px;"></div>');
            widgetElm.append($marquee);

            // determine the unit/pixel ratio
            var transformMultiplier = unitWidth / pixelWidth;

            // updates marquee with preview of new width
            var mousemove = function (e) {
                var curX = e.clientX;
                var pixelChange = curX - initX;
                var newWidth = pixelWidth + pixelChange;
                $marquee.css('width', newWidth + 'px');
            };

            // sets new widget width on mouseup
            var mouseup = function (e) {
                // remove listener and marquee
                jQuery($window).off('mousemove', mousemove);
                $marquee.remove();

                // calculate change in units
                var curX = e.clientX;
                var pixelChange = curX - initX;
                var unitChange = Math.round(pixelChange * transformMultiplier * 100) / 100;

                // add to initial unit width
                var newWidth = unitWidth * 1 + unitChange;
                widget.setWidth(newWidth + widthUnits);
                $scope.$emit('widgetChanged', widget);
                $scope.$apply();
            };

            jQuery($window).on('mousemove', mousemove).one('mouseup', mouseup);
        };

        $scope.grabVertResizer = function (e) {

            var widget = $scope.widget;
            var widgetElm = $element.find('.widget');

            // ignore middle- and right-click
            if (e.which !== 1) {
                return;
            }

            e.stopPropagation();
            e.originalEvent.preventDefault();

            // get the starting vertical position
            var initY = e.clientY;

            // Get the current width of the widget and dashboard
            var pixelWidth = widgetElm.width();
            var pixelHeight = widgetElm.height();
            var widgetStyleHeight = widget.style.height;
            var heightUnits = widget.heightUnits;
            var unitHeight = parseFloat(widgetStyleHeight);

            // create marquee element for resize action
            var $marquee = angular.element('<div class="widget-resizer-marquee" style="height: ' + pixelHeight + 'px; width: ' + pixelWidth + 'px;"></div>');
            widgetElm.append($marquee);

            // determine the unit/pixel ratio
            var transformMultiplier = unitHeight / pixelHeight;

            // updates marquee with preview of new width
            var mousemove = function (e) {
                var curY = e.clientY;
                var pixelChange = curY - initY;
                var newHeight = pixelHeight + pixelChange;
                $marquee.css('height', newHeight + 'px');
            };

            // sets new widget height on mouseup
            var mouseup = function (e) {
                // remove listener and marquee
                jQuery($window).off('mousemove', mousemove);
                $marquee.remove();

                // calculate change in units
                var curY = e.clientY;
                var pixelChange = curY - initY;
                var unitChange = Math.round(pixelChange * transformMultiplier * 100) / 100;

                // add to initial unit width
                var newHeight = unitHeight * 1 + unitChange;
                widget.setHeight(newHeight + heightUnits);
                $scope.$emit('widgetChanged', widget);
                $scope.$apply();
            };

            jQuery($window).on('mousemove', mousemove).one('mouseup', mouseup);
        };

        // replaces widget title with input
        $scope.editTitle = function (widget) {
            var widgetElm = $element.find('.widget');
            widget.editingTitle = true;
            // HACK: get the input to focus after being displayed.
            $timeout(function () {
                widgetElm.find('form.widget-title input:eq(0)').focus()[0].setSelectionRange(0, 9999);
            });
        };

        // saves whatever is in the title input as the new title
        $scope.saveTitleEdit = function (widget) {
            widget.editingTitle = false;
            $scope.$emit('widgetChanged', widget);
        };

        $scope.compileTemplate = function() {
            var container = $scope.findWidgetContainer($element);
            var templateString = $scope.makeTemplateString();
            var widgetElement = angular.element(templateString);

            container.empty();
            container.append(widgetElement);
            $compile(widgetElement)($scope);
        };

        $scope.findWidgetContainer = function(element) {
            // widget placeholder is the first (and only) child of .widget-content
            return element.find('.widget-content');
        };
    }]);
/*
 * Copyright (c) 2014 DataTorrent, Inc. ALL Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

angular.module('ui.dashboard')
  .controller('WidgetDialogCtrl', ['$scope', '$modalInstance', 'widget', 'optionsTemplateUrl', function ($scope, $modalInstance, widget, optionsTemplateUrl) {
    // add widget to scope
    $scope.widget = widget;

    // set up result object
    $scope.result = {
      title: widget.title
    };

    // look for optionsTemplateUrl on widget
    $scope.optionsTemplateUrl = optionsTemplateUrl || 'template/widget-default-content.html';

    $scope.ok = function () {
      $modalInstance.close($scope.result);
    };

    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };
  }]);
/**
 * Created by Sheppe Pharis, June 2014.
 *
 * An AngularJS wrapper for jquery.shapeshift.
 */

// The move function is used for moving an element in an array from one index to another.
// This function is used by Angular Shapeshift to keep the array of items, which make up
// the children of the Shapeshift container, in sync with the display order of said children.
Array.prototype.move = function (old_index, new_index) {
    while (old_index < 0) {
        old_index += this.length;
    }
    while (new_index < 0) {
        new_index += this.length;
    }
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

angular.module('shapeshift', [])
    // Used for setting the configuration options to pass to Shapeshift. Use the options as defined at:
    // https://github.com/McPants/jquery.shapeshift/wiki/2.0-api-documentation#shapeshift-options
    // The options should be passed in as an array.
    .value('shapeshiftConfig', {})

    // The shapeshiftTriggers service provides access to the various events that can be triggered on
    // the shapeshift container provided in the element parameter.
    .service('shapeshiftTriggers', function(){
        this.rearrange = function(element){
            $(element).trigger('ss-rearrange');
        };

        this.shuffle = function(element){
            $(element).trigger('ss-shuffle');
        };

        this.destroy = function(element){
            $(element).trigger('ss-destroy');
        };
    })

    .directive('uiShapeshift', [
        'shapeshiftConfig', 'shapeshiftTriggers',
        '$rootScope', '$timeout', '$log',
        function(shapeshiftConfig, shapeshiftTriggers, $rootScope, $timeout, $log){
            return{
                require: '?ngModel',
                restrict: 'A',
                scope: {widgets: '=ngModel', widget: '='},
                transclude: true,
                template: '<div ng-transclude></div>',
                terminal: true,
                replace: true,
                controller: function($scope, $element, $attrs){},
                link: function(scope, element, attrs, ngModel) {
                    // For storing configuration options.
                    var ssConfig = {};

                    // Make the .shapeshift() call on the current element.
                    var shapeShift = function(){
                        $(element).shapeshift(ssConfig);
                    };

                    // Put the configuration options into the ssConfig variable.
                    // Configuration options can be passed in either via assigning them to the ui-shapeshift
                    // attribute in the HTML, or by setting the shapeshiftConfig value.
                    angular.extend(ssConfig, shapeshiftConfig, scope.$eval(attrs.uiShapeshift));

                    if (!angular.element.fn || !angular.element.fn.jquery) {
                        $log.error('Angular Shapeshift: jQuery should be included before AngularJS!');
                        return;
                    }

                    if(typeof _.findIndex === 'undefined'){
                        $log.error('Angular Shapeshift: Lodash must be referenced!');
                        return;
                    }

                    if (!ngModel) {
                        $log.error('Angular Shapeshift: You must specify a model using ng-model on the shapeshift container.');
                    } else {

                        scope.$watch(attrs.ngModel + '.length', function () {
                            // Timeout to let ng-repeat modify the DOM.
                            $timeout(function () {
                                // A counter.
                                var x = 0;

                                // For tracking the width of the child controls.
                                var w = 0;
                                var smallest = 0;

                                // For tracking the largest number of columns we're using.
                                var cols = 1;

                                $(element).children().each(function(){
                                    var c = $(this);

                                    // Associate the $$hashKey of each item in the ngModel array with the corresponding child
                                    // in this container. This will allow us to reposition the items in the ngModel array later
                                    // by comparing the $$hashKey attribute with the value associate with the child.
                                    c.attr('ss-key', ngModel.$modelValue[x].$$hashKey);

                                    // Initialize the smallest child variable to the first item.
                                    if(x === 0){
                                        smallest = parseInt(c.width());
                                    }

                                    // The width of the current child.
                                    w = parseInt(c.width());

                                    // Record the width of the smallest item, as it is what is used to determine the width
                                    // of a 1 span cell in the grid.
                                    if(w < smallest){
                                        smallest = w;
                                    }

                                    x++;
                                });

                                x = 0;
                                $(element).children().each(function(){
                                    var c = $(this);

                                    // Make sure there's a data-ss-colspan attribute. This attribute
                                    // is used by Shapeshift to ensure it allocates enough room in its
                                    // grid for wider elements.

                                    // Check the width of this item, and if it's larger than the smallest one then
                                    // determine how much larger and set the data-ss-colspan property appropriately.
                                    var d = parseInt(c.width()) - smallest;

                                    if(d === 0){
                                        // The element is the same size as the smallest one.
                                        c.attr('data-ss-colspan', 1);
                                    }
                                    else{
                                        // Calculate the number of columns to allocate for this child.
                                        d = 1 + Math.round(d / smallest);

                                        if(d > cols){
                                            cols = d;
                                        }

                                        c.attr('data-ss-colspan', d);
                                    }

                                    x++;
                                });

                                // Update the minimum number of columns to use in the container.
                                ssConfig['minColumns'] = cols;

                                // Activate Shapeshift for the container.
                                shapeShift();

                                // Trigger a rearrange.
                                shapeshiftTriggers.rearrange(element);
                            });
                        });

                        /* Capture the jQuery events fired by Shapeshift, and re-broadcast them as Angular events. */
                        element.on('ss-arranged', function (e) {
                            // When an item is dragged around in a container, arranged is triggered every time items are shifted.
                            $rootScope.$broadcast('ss-arranged', [e]);
                        });

                        element.on('ss-rearranged', function (e, selected) {
                            // When an item is dropped into the container it originated from.

                            // Before re-broadcasting the event, we need to arrange the items in the ngModel array to match
                            // the order of the children in this container.
                            $(this).children().each(function(){
                                var c = $(this);
                                if(c.attr('ss-key') && c.attr('ss-key') != "") {
                                    var i = _.findIndex(ngModel.$modelValue, function (i) {
                                        if (i.$$hashKey) {
                                            return i.$$hashKey == c.attr('ss-key');
                                        }
                                    });

                                    // Move the element in the array to match the order of children in this container.
                                    ngModel.$modelValue.move(i, c.index());
                                }
                            });

                            $rootScope.$broadcast('ss-rearranged', [e, selected]);
                        });

                        element.on('ss-drop-complete', function (e) {
                            // When an item is dropped into a container, this gets called when it has stopped moving to its new position.
                            $rootScope.$broadcast('ss-drop-complete', [e]);
                        });

                        element.on('ss-added', function (e, selected) {
                            // When an item is dropped into a container it didn't originate from.
                            $rootScope.$broadcast('ss-added', [e, selected]);
                        });

                        element.on('ss-removed', function (e, selected) {
                            // When an item is dropped into a container it didn't originate from.
                            $rootScope.$broadcast('ss-removed', [e, selected]);
                        });

                        element.on('ss-trashed', function (e, selected) {
                            // When an item is dropped into a container that has trash enabled and therefore is removed from the DOM.
                            $rootScope.$broadcast('ss-trashed', [e, selected]);
                        });
                    }
                }
            }
        }])
;

angular.module("ui.dashboard").run(["$templateCache", function($templateCache) {

  $templateCache.put("template/alt-dashboard.html",
    "<div>\r" +
    "\n" +
    "    <div class=\"btn-toolbar\" ng-if=\"!options.hideToolbar\">\r" +
    "\n" +
    "        <div class=\"btn-group\" ng-if=\"!options.widgetButtons\">\r" +
    "\n" +
    "            <button type=\"button\" class=\"dropdown-toggle btn btn-primary\" data-toggle=\"dropdown\">Add Widget <span\r" +
    "\n" +
    "                    class=\"caret\"></span></button>\r" +
    "\n" +
    "            <ul class=\"dropdown-menu\" role=\"menu\">\r" +
    "\n" +
    "                <li ng-repeat=\"widget in widgetDefs\">\r" +
    "\n" +
    "                    <a href=\"#\" ng-click=\"addWidgetInternal($event, widget);\"><span class=\"label label-primary\">{{widget.name}}</span></a>\r" +
    "\n" +
    "                </li>\r" +
    "\n" +
    "            </ul>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "        <div class=\"btn-group\" ng-if=\"options.widgetButtons\">\r" +
    "\n" +
    "            <button ng-repeat=\"widget in widgetDefs\"\r" +
    "\n" +
    "                    ng-click=\"addWidgetInternal($event, widget);\" type=\"button\" class=\"btn btn-primary\">\r" +
    "\n" +
    "                {{widget.name}}\r" +
    "\n" +
    "            </button>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "        <button class=\"btn btn-warning\" ng-click=\"resetWidgetsToDefault()\">Default Widgets</button>\r" +
    "\n" +
    "\r" +
    "\n" +
    "        <button ng-if=\"options.storage && options.explicitSave\" ng-click=\"options.saveDashboard()\" class=\"btn btn-success\" ng-hide=\"!options.unsavedChangeCount\">{{ !options.unsavedChangeCount ? \"Alternative - No Changes\" : \"Save\" }}</button>\r" +
    "\n" +
    "\r" +
    "\n" +
    "        <button ng-click=\"clear();\" ng-hide=\"!widgets.length\" type=\"button\" class=\"btn btn-info\">Clear</button>\r" +
    "\n" +
    "    </div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "    <div id=\"dashboard\" ui-shapeshift=\"sortableOptions\" ng-model=\"widgets\" class=\"dashboard-widget-area\">\r" +
    "\n" +
    "        <div ng-repeat=\"widget in widgets\" ng-style=\"widget.style\" class=\"widget-container\" widget>\r" +
    "\n" +
    "            <div class=\"widget panel panel-default\">\r" +
    "\n" +
    "                <div class=\"widget-header panel-heading\">\r" +
    "\n" +
    "                    <h3 class=\"panel-title\">\r" +
    "\n" +
    "                        <span class=\"widget-title\" ng-dblclick=\"editTitle(widget)\" ng-hide=\"widget.editingTitle\">{{widget.title}}</span>\r" +
    "\n" +
    "                        <form action=\"\" class=\"widget-title\" ng-show=\"widget.editingTitle\" ng-submit=\"saveTitleEdit(widget)\">\r" +
    "\n" +
    "                            <input type=\"text\" ng-model=\"widget.title\" class=\"form-control\">\r" +
    "\n" +
    "                        </form>\r" +
    "\n" +
    "                        <span ng-click=\"removeWidget(widget);\" class=\"glyphicon glyphicon-remove\" ng-if=\"!options.hideWidgetClose\"></span>\r" +
    "\n" +
    "                        <span ng-click=\"openWidgetDialog(widget);\" class=\"glyphicon glyphicon-cog\" ng-if=\"!options.hideWidgetOptions\"></span>\r" +
    "\n" +
    "                    </h3>\r" +
    "\n" +
    "                </div>\r" +
    "\n" +
    "                <div class=\"panel-body widget-content\"></div>\r" +
    "\n" +
    "                <div class=\"widget-ew-resizer\" ng-mousedown=\"grabResizer($event)\"></div>\r" +
    "\n" +
    "                <div class=\"widget-ns-resizer\" ng-mousedown=\"grabVertResizer($event)\"></div>\r" +
    "\n" +
    "            </div>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "    </div>\r" +
    "\n" +
    "</div>\r" +
    "\n"
  );

  $templateCache.put("template/dashboard-layouts.html",
    "<ul class=\"nav nav-tabs layout-tabs\">\r" +
    "\n" +
    "    <li ng-repeat=\"layout in layouts\" ng-class=\"{ active: layout.active }\">\r" +
    "\n" +
    "        <a ng-click=\"makeLayoutActive(layout)\">\r" +
    "\n" +
    "            <span ng-dblclick=\"editTitle(layout)\" ng-show=\"!layout.editingTitle\">{{layout.title}}</span>\r" +
    "\n" +
    "            <form action=\"\" class=\"layout-title\" ng-show=\"layout.editingTitle\" ng-submit=\"saveTitleEdit(layout)\">\r" +
    "\n" +
    "                <input type=\"text\" ng-model=\"layout.title\" class=\"form-control\" data-layout=\"{{layout.id}}\">\r" +
    "\n" +
    "            </form>\r" +
    "\n" +
    "            <span ng-click=\"removeLayout(layout)\" class=\"glyphicon glyphicon-remove remove-layout-icon\"></span>\r" +
    "\n" +
    "            <!-- <span class=\"glyphicon glyphicon-pencil\"></span> -->\r" +
    "\n" +
    "            <!-- <span class=\"glyphicon glyphicon-remove\"></span> -->\r" +
    "\n" +
    "        </a>\r" +
    "\n" +
    "    </li>\r" +
    "\n" +
    "    <li>\r" +
    "\n" +
    "        <a ng-click=\"createNewLayout()\">\r" +
    "\n" +
    "            <span class=\"glyphicon glyphicon-plus\"></span>\r" +
    "\n" +
    "        </a>\r" +
    "\n" +
    "    </li>\r" +
    "\n" +
    "</ul>\r" +
    "\n" +
    "<div ng-repeat=\"layout in layouts | filter:isActive\" dashboard=\"layout.dashboard\" templateUrl=\"template/dashboard.html\"></div>"
  );

  $templateCache.put("template/dashboard.html",
    "<div>\r" +
    "\n" +
    "    <div class=\"btn-toolbar\" ng-if=\"!options.hideToolbar\">\r" +
    "\n" +
    "        <!--<div class=\"btn-group\" ng-if=\"!options.widgetButtons\">\r" +
    "\n" +
    "            <button type=\"button\" class=\"dropdown-toggle btn btn-primary\" data-toggle=\"dropdown\">Add Widget <span\r" +
    "\n" +
    "                    class=\"caret\"></span></button>\r" +
    "\n" +
    "            <ul class=\"dropdown-menu\" role=\"menu\">\r" +
    "\n" +
    "                <li ng-repeat=\"widget in widgetDefs\">\r" +
    "\n" +
    "                    <a href=\"#\" ng-click=\"addWidgetInternal($event, widget);\"><span class=\"label label-primary\">{{widget.name}}</span></a>\r" +
    "\n" +
    "                </li>\r" +
    "\n" +
    "            </ul>\r" +
    "\n" +
    "        </div>-->\r" +
    "\n" +
    "\r" +
    "\n" +
    "        <div class=\"btn-group\" ng-if=\"options.widgetButtons\">\r" +
    "\n" +
    "            <button ng-repeat=\"widget in widgetDefs\"\r" +
    "\n" +
    "                    ng-click=\"addWidgetInternal($event, widget);\" type=\"button\" class=\"btn btn-primary\">\r" +
    "\n" +
    "                {{widget.name}}\r" +
    "\n" +
    "            </button>\r" +
    "\n" +
    "\r" +
    "\n" +
    "            <button class=\"btn btn-warning\" ng-click=\"resetWidgetsToDefault()\">Default Widgets</button>\r" +
    "\n" +
    "\r" +
    "\n" +
    "            <button ng-if=\"options.storage && options.explicitSave\" ng-click=\"options.saveDashboard()\" class=\"btn btn-success\" ng-disabled=\"!options.unsavedChangeCount\">{{ !options.unsavedChangeCount ? \"all saved\" : \"save changes (\" + options.unsavedChangeCount + \")\" }}</button>\r" +
    "\n" +
    "\r" +
    "\n" +
    "            <button ng-click=\"clear();\" type=\"button\" class=\"btn btn-info\">Clear</button>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "    </div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "    <div id=\"dashboard\" ui-shapeshift=\"sortableOptions\" ng-model=\"widgets\" class=\"dashboard-widget-area\">\r" +
    "\n" +
    "        <div ng-repeat=\"widget in widgets\" ng-style=\"widget.style\" class=\"widget-container\" widget>\r" +
    "\n" +
    "            <div class=\"widget panel panel-default\">\r" +
    "\n" +
    "                <div class=\"widget-header panel-heading\">\r" +
    "\n" +
    "                    <h3 class=\"panel-title\">\r" +
    "\n" +
    "                        <span class=\"widget-title\" ng-dblclick=\"editTitle(widget)\" ng-hide=\"widget.editingTitle\">{{widget.title}}</span>\r" +
    "\n" +
    "                        <form action=\"\" class=\"widget-title\" ng-show=\"widget.editingTitle\" ng-submit=\"saveTitleEdit(widget)\">\r" +
    "\n" +
    "                            <input type=\"text\" ng-model=\"widget.title\" class=\"form-control\">\r" +
    "\n" +
    "                        </form>\r" +
    "\n" +
    "                        <span ng-click=\"removeWidget(widget);\" class=\"glyphicon glyphicon-remove\" ng-if=\"!options.hideWidgetClose\"></span>\r" +
    "\n" +
    "                        <span ng-click=\"openWidgetDialog(widget);\" class=\"glyphicon glyphicon-cog\" ng-if=\"!options.hideWidgetOptions\"></span>\r" +
    "\n" +
    "                    </h3>\r" +
    "\n" +
    "                </div>\r" +
    "\n" +
    "                <div class=\"panel-body widget-content\"></div>\r" +
    "\n" +
    "                <div class=\"widget-ew-resizer\" ng-mousedown=\"grabResizer($event)\"></div>\r" +
    "\n" +
    "                <div class=\"widget-ns-resizer\" ng-mousedown=\"grabVertResizer($event)\"></div>\r" +
    "\n" +
    "            </div>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "    </div>\r" +
    "\n" +
    "</div>"
  );

  $templateCache.put("template/save-changes-modal.html",
    "<div class=\"modal-header\">\r" +
    "\n" +
    "    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\" ng-click=\"cancel()\">&times;</button>\r" +
    "\n" +
    "  <h3>Unsaved Changes to \"{{layout.title}}\"</h3>\r" +
    "\n" +
    "</div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "<div class=\"modal-body\">\r" +
    "\n" +
    "    <p>You have {{layout.dashboard.unsavedChangeCount}} unsaved changes on this dashboard. Would you like to save them?</p>\r" +
    "\n" +
    "</div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "<div class=\"modal-footer\">\r" +
    "\n" +
    "    <button type=\"button\" class=\"btn btn-default\" ng-click=\"cancel()\">Don't Save</button>\r" +
    "\n" +
    "    <button type=\"button\" class=\"btn btn-primary\" ng-click=\"ok()\">Save</button>\r" +
    "\n" +
    "</div>"
  );

  $templateCache.put("template/widget-default-content.html",
    ""
  );

  $templateCache.put("template/widget-template.html",
    "<div class=\"modal-header\">\r" +
    "\n" +
    "    <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-hidden=\"true\" ng-click=\"cancel()\">&times;</button>\r" +
    "\n" +
    "  <h3>Widget Options <small>{{widget.title}}</small></h3>\r" +
    "\n" +
    "</div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "<div class=\"modal-body\">\r" +
    "\n" +
    "    <form name=\"form\" novalidate class=\"form-horizontal\">\r" +
    "\n" +
    "        <div class=\"form-group\">\r" +
    "\n" +
    "            <label for=\"widgetTitle\" class=\"col-sm-2 control-label\">Title</label>\r" +
    "\n" +
    "            <div class=\"col-sm-10\">\r" +
    "\n" +
    "                <input type=\"text\" class=\"form-control\" name=\"widgetTitle\" ng-model=\"result.title\">\r" +
    "\n" +
    "            </div>\r" +
    "\n" +
    "        </div>\r" +
    "\n" +
    "        <div ng-include=\"optionsTemplateUrl\"></div>\r" +
    "\n" +
    "    </form>\r" +
    "\n" +
    "</div>\r" +
    "\n" +
    "\r" +
    "\n" +
    "<div class=\"modal-footer\">\r" +
    "\n" +
    "    <button type=\"button\" class=\"btn btn-default\" ng-click=\"cancel()\">Cancel</button>\r" +
    "\n" +
    "    <button type=\"button\" class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\r" +
    "\n" +
    "</div>"
  );

}]);
