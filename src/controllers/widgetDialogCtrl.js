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
        title: widget.title,
        refreshInterval: widget.refreshInterval
      };

      // Intervals are stored in milliseconds, but we're presenting them to the user in minutes. Convert the value.
      var currentInterval = $scope.result.refreshInterval / 60 / 1000;
      var validIntervals = [0,1,5,10,15,30,60,360,720];

      // For setting the widget's refresh interval.
      $scope.refresh = {
        // Index of selected fresh interval.
        interval: _.indexOf(validIntervals, currentInterval),
        // Valid refresh intervals (in minutes).
        intervals: validIntervals,
        intervalsMax: validIntervals.length - 1
      };

      // Used for setting friendly display of the refresh interval selected by the user.
      $scope.translateRefreshIntervals = function(value){
        if($scope.refresh.intervals[value] == 0){
          return 'Never';
        }
        else if($scope.refresh.intervals[value] == 1){
          return $scope.refresh.intervals[value].toString() + ' minute';
        }
        else if($scope.refresh.intervals[value] > 1 && $scope.refresh.intervals[value] <= 60) {
          return $scope.refresh.intervals[value].toString() + ' minutes';
        }
        else if($scope.refresh.intervals[value] == 60){
          return ($scope.refresh.intervals[value] / 60).toString() + ' hour'
        }
        else if($scope.refresh.intervals[value] > 60){
          return ($scope.refresh.intervals[value] / 60).toString() + ' hours'
        }
      };

      // look for optionsTemplateUrl on widget
      $scope.optionsTemplateUrl = optionsTemplateUrl || 'template/widget-default-content.html';

      $scope.ok = function () {
        $modalInstance.close($scope.result);
      };

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };

      // Watch for when the user changes the refresh interval.
      $scope.$watch('refresh.interval', function(newVal, oldVal){
        if(newVal != oldVal){
          // The user is selecting minutes, but the timer is in milliseconds, so convert.
          $scope.result.refreshInterval = $scope.refresh.intervals[newVal] * 60 * 1000;
        }
      });

    }]);