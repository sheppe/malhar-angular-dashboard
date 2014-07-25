/*
 * Copyright (c) [Sheppe Pharis] [Sheppe Pharis]
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

/*
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

                if(typeof _ === 'undefined'){
                    $log.error('Angular Shapeshift: Lodash must be referenced!');
                    return;
                }

                if (!ngModel) {
                    $log.error('Angular Shapeshift: You must specify a model using ng-model on the shapeshift container.');
                } else {

                    scope.$watch(attrs.ngModel + '.length', function () {
                        // Timeout to let ng-repeat modify the DOM.
                        $timeout(function () {
                            // Associate the $$hashKey of each item in the ngModel array with the corresponding child
                            // in this container. This will allow us to reposition the items in the ngModel array later
                            // by comparing the $$hashKey attribute with the value associate with the child.
                            var x = 0;

                            $(element).children().each(function(){
                                var c = $(this);
                                c.attr('ss-key', ngModel.$modelValue[x].$$hashKey);
                                x++;
                            });

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
                            if(c.attr('widget-id') != "") {
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
