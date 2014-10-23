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

    // Used for storing the ID of the shapeshift hosting container.
    .value('shapeshiftHostId', 'dashboard')

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

    .service('shapeshift', function(){
        this.shapeshiftElement = function(element, shapeshiftOptions){
            $(element).shapeshift(shapeshiftOptions);
        };
    })

    .directive('uiShapeshift', [
        'shapeshiftConfig', 'shapeshiftHostId', 'shapeshiftTriggers', 'shapeshift',
        '$rootScope', '$timeout', '$log',
        function(shapeshiftConfig, shapeshiftHostId, shapeshiftTriggers, shapeshift, $rootScope, $timeout, $log){
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
                        shapeshift.shapeshiftElement(element, ssConfig); //$(element).shapeshift(ssConfig);
                    };

                    // Put the configuration options into the ssConfig variable.
                    // Configuration options can be passed in either via assigning them to the ui-shapeshift
                    // attribute in the HTML, or by setting the shapeshiftConfig value.
                    angular.extend(ssConfig, shapeshiftConfig, scope.$eval(attrs.uiShapeshift));

                    // Set the ID of the element we're attaching to, if it's not already set.
                    element.context.id = element.context.id || shapeshiftHostId;

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
