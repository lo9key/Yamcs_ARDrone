(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.mdb', ['yamcs.core'])
        .config(configure);

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.when('/:instance/mdb', {
            templateUrl: '/_static/_site/mdb/pages/index.html',
            controller: 'MDBIndexController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/parameters', {
            templateUrl: '/_static/_site/mdb/pages/parameters.html',
            controller: 'MDBParametersController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/containers', {
            templateUrl: '/_static/_site/mdb/pages/containers.html',
            controller: 'MDBContainersController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/commands', {
            templateUrl: '/_static/_site/mdb/pages/commands.html',
            controller: 'MDBCommandsController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/algorithms', {
            templateUrl: '/_static/_site/mdb/pages/algorithms.html',
            controller: 'MDBAlgorithmsController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/algorithms/:name', {
            templateUrl: '/_static/_site/mdb/pages/algorithm-detail.html',
            controller: 'MDBAlgorithmDetailController',
            controllerAs: 'vm'
        }).when('/:instance/mdb/:ss*/:name', {
            templateUrl: '/_static/_site/mdb/pages/parameter-detail.html',
            controller: 'MDBParameterDetailController',
            controllerAs: 'vm'
        });
    }
})();

(function () {
    'use strict';

    MDBParametersController.$inject = ["$rootScope", "mdbService", "$routeParams"];
    angular
        .module('yamcs.mdb')
        .controller('MDBParametersController',  MDBParametersController);

    /* @ngInject */
    function MDBParametersController($rootScope, mdbService, $routeParams) {
        var vm = this;

        var qname  = '/' + $routeParams['ss'];
        vm.qname = qname;
        vm.title = qname;
        vm.mdbType = 'parameters';
        vm.includesNested = includesNested;

        $rootScope.pageTitle = 'Parameters | Yamcs';

        mdbService.listParameters({
            namespace: qname,
            recurse: includesNested()
        }).then(function (data) {
            vm.parameters = data;
            return vm.parameters;
        });

        function includesNested() {
            return qname === '/yamcs';
        }
    }
})();

(function() {
    'use strict';

    MDBParameterDetailController.$inject = ["$rootScope", "$scope", "$routeParams", "$q", "$uibModal", "tmService", "mdbService", "configService", "alarmsService"];
    angular.module('yamcs.mdb').controller('MDBParameterDetailController', MDBParameterDetailController);

    /* @ngInject */
    function MDBParameterDetailController($rootScope, $scope, $routeParams, $q, $uibModal, tmService, mdbService, configService, alarmsService) {
        $rootScope.pageTitle = $routeParams.name + ' | Yamcs';

        // Will be augmented when passed into directive
        $scope.plotController = {};

        $scope.plotctx = {
            range: configService.get('initialPlotRange', '1h')
        };

        $scope.samples = [{
            name: null,
            points: [],
            min: null,
            max: null
        }];

        var loadingHistory = false;
        var apparentlyNumericSystemParameter = false;
        var lastSamplePromiseCanceler;

        $scope.alarms = [];
        mdbService.getParameterInfo('/' + $routeParams['ss'] + '/' + $routeParams.name).then(function (data) {

            $scope.info = mapAlarmRanges(data);
            var qname = $scope.info['qualifiedName'];

            // Called by plot directive when user zooms. Load detailed samples.
            $scope.onZoom = function(startDate, stopDate) {
                if (lastSamplePromiseCanceler) {
                    lastSamplePromiseCanceler.resolve();
                }
                lastSamplePromiseCanceler = $q.defer();
                tmService.getParameterSamples(qname, {
                    start: startDate.toISOString().slice(0, -1),
                    stop: stopDate.toISOString().slice(0, -1)
                }, lastSamplePromiseCanceler).then(function (data) {
                    $scope.plotController.spliceDetailSamples(data);
                });
            };

            $scope.$on('yamcs.tm.pvals', function(event, pvals) {
                for(var i = 0; i < pvals.length; i++) {
                    var pval = pvals[i];
                    if (pval.id.name === qname) {
                        $scope.para = pval;
                        // Live data is added to the plot, except when we are loading a chunk of historic
                        // data. This may mean that we miss a few points though, but that's acceptable for now.
                        if (!loadingHistory && $scope.isNumeric()) {
                            $scope.plotController.appendPoint(pval);
                        } else {
                            console.log('ignoring a point');
                        }
                    }
                }
            });

            alarmsService.listAlarmsForParameter(qname).then(function (alarms) {
                $scope.alarms = alarms;

                // Both dependencies are now fetched (could improve towards parallel requests though)
                // So continue on

                tmService.subscribeParameters([{name: qname}]);

                $scope.$on('$destroy', function() {
                    // TODO tmService.unsubscribeParameter(subscriptionId);
                });

                tmService.getParameterHistory(qname, {
                    norepeat: true,
                    limit: 10
                }).then(function (historyData) {
                    $scope.values = historyData['parameter'];

                    // FIXME additional checks for system parameters which don't have a type :(
                    if (qname.indexOf('/yamcs') === 0 && $scope.values.length > 0) {
                        var valType = $scope.values[0]['engValue']['type'];
                        if (valType === 'SINT64'
                                || valType === 'UINT64'
                                || valType === 'SINT32'
                                || valType === 'UINT32') {
                            apparentlyNumericSystemParameter = true;
                        }
                    }
                });

                $scope.activeAlarms = alarmsService.getActiveAlarms(); // Live collection
                $scope.activeAlarm = alarmsService.getActiveAlarmForParameter(qname);
                $scope.$watchCollection('activeAlarms', function (activeAlarms) {
                    var match = false;
                    for (var i = 0; i < activeAlarms.length; i++) {
                        var alarm = activeAlarms[i];
                        if (alarm['triggerValue']['id']['name'] === qname) {
                            $scope.activeAlarm = alarm;
                            match = true;
                            break;
                        }
                    }
                    if (!match) $scope.activeAlarm = null;
                    // TODO should maybe update alarm history table
                });


                return $scope.alarms;
            });

            $scope.$watchGroup(['plotctx.range', 'plotController.initialized'], function (values) {
                var mode = values[0];
                if ($scope.plotController.initialized) {
                    $scope.plotController.startSpinner(); // before setting samples to null, so effects get considered in empty redraw
                    loadingHistory = true;
                    $scope.samples = null;
                    loadHistoricData(qname, mode).then(function (data) {
                        $scope.plotController.stopSpinner();
                        $scope.samples = data;
                        loadingHistory = false;
                    });
                }
            });

            $scope.openAcknowledge = function(alarm) {
                var form = {
                    comment: undefined
                };
                $uibModal.open({
                  animation: true,
                  templateUrl: 'acknowledgeAlarmModal.html',
                  controller: 'AcknowledgeAlarmModalController',
                  size: 'lg',
                  resolve: {
                    alarm: function () {
                        return alarm;
                    },
                    form: function () {
                        return form;
                    }
                  }
                });
            };

            return $scope.info;
        });

        $scope.openEnumValuesModal = function() {
            $uibModal.open({
                animation: true,
                templateUrl: 'enumValuesModal.html',
                controller: 'ValueEnumerationModalInstanceController',
                size: 'lg',
                resolve: {
                    info: function () {
                        return $scope.info;
                    }
                }
            });
        };
        $scope.addParameterModal = function() {
            $uibModal.open({
                animation: true,
                templateUrl: 'addParameterModal.html',
                controller: 'AddParameterModalInstanceController',
                size: 'md'
            });
        };

        $scope.expandAlarms = function() {
            for (var i = 0; i < $scope.alarms.length; i++) {
                $scope.alarms[i].expanded = true;
            }
        };

        $scope.collapseAlarms = function() {
            for (var i = 0; i < $scope.alarms.length; i++) {
                $scope.alarms[i].expanded = false;
            }
        };

        $scope.isNumeric = function() {
            if ($scope.hasOwnProperty('info') && $scope.info.hasOwnProperty('type') && $scope.info.type.hasOwnProperty('engType')) {
                return $scope.info.type.engType === 'float' || $scope.info.type.engType === 'integer';
            } else if (apparentlyNumericSystemParameter) {
                return true;
            }
            return false;
        };

        function loadHistoricData(qname, period) {
            var now = new Date();
            var nowIso = now.toISOString();
            var before = new Date(now.getTime());
            var beforeIso = nowIso;
            if (period === '15m') {
                before.setMinutes(now.getMinutes() - 15);
                beforeIso = before.toISOString();
            } else if (period === '30m') {
                before.setMinutes(now.getMinutes() - 30);
                beforeIso = before.toISOString();
            } else if (period === '1h') {
                before.setHours(now.getHours() - 1);
                beforeIso = before.toISOString();
            } else if (period === '5h') {
                before.setHours(now.getHours() - 5);
                beforeIso = before.toISOString();
            } else if (period === '1d') {
                before.setDate(now.getDate() - 1);
                beforeIso = before.toISOString();
            } else if (period === '1w') {
                before.setDate(now.getDate() - 7);
                beforeIso = before.toISOString();
            } else if (period === '1m') {
                before.setDate(now.getDate() - 31);
                beforeIso = before.toISOString();
            } else if (period === '3m') {
                before.setDate(now.getDate() - (3*31));
                beforeIso = before.toISOString();
            } else if (period === '1y') {
                before.setDate(now.getDate() - 365);
                beforeIso = before.toISOString();
            }

            if (lastSamplePromiseCanceler) {
                lastSamplePromiseCanceler.resolve();
            }
            lastSamplePromiseCanceler = $q.defer();
            return tmService.getParameterSamples(qname, {
                start: beforeIso.slice(0, -1),
                stop: nowIso.slice(0, -1)
            }, lastSamplePromiseCanceler);
        }
    }

    function mapAlarmRanges(info) {
        if (info.hasOwnProperty('type')) {
            var type = info.type;
            if (type.hasOwnProperty('defaultAlarm')) {
                var defaultAlarm = type['defaultAlarm'];
                if (defaultAlarm.hasOwnProperty('staticAlarmRange')) {
                    var ranges = defaultAlarm['staticAlarmRange'];
                    for (var i = 0; i < ranges.length; i++) {
                        var range = ranges[i];
                        switch (range['level']) {
                            case 'WATCH': info.watch = range; break;
                            case 'WARNING': info.warning = range; break;
                            case 'DISTRESS': info.distress = range; break;
                            case 'CRITICAL': info.critical = range; break;
                            case 'SEVERE': info.severe = range;
                        }
                    }
                }
            }
        }
        return info;
    }
})();

(function () {
    'use strict';

    MDBIndexController.$inject = ["$rootScope", "mdbService"];
    angular
        .module('yamcs.mdb')
        .controller('MDBIndexController',  MDBIndexController);

    /* @ngInject */
    function MDBIndexController($rootScope, mdbService) {
        var vm = this;
        vm.title = 'Mission Database';
        $rootScope.pageTitle = vm.title + ' | Yamcs';

        mdbService.getSummary().then(function (mdb) {
            vm.mdb = mdb;
            return vm.mdb;
        });
    }
})();

(function () {
    'use strict';

    MDBContainersController.$inject = ["$rootScope", "mdbService", "$routeParams"];
    angular
        .module('yamcs.mdb')
        .controller('MDBContainersController',  MDBContainersController);

    /* @ngInject */
    function MDBContainersController($rootScope, mdbService, $routeParams) {
        var vm = this;

        var qname = '/' + $routeParams['ss'];

        vm.qname = qname;
        vm.title = qname;
        vm.mdbType = 'containers';

        $rootScope.pageTitle = 'Containers | Yamcs';

        mdbService.listContainers({
            namespace: qname,
            recurse: (qname === '/yamcs')
        }).then(function (data) {
            vm.containers = data;
            return vm.containers;
        });
    }
})();

(function () {
    'use strict';

    MDBCommandsController.$inject = ["$rootScope", "mdbService", "$routeParams"];
    angular
        .module('yamcs.mdb')
        .controller('MDBCommandsController',  MDBCommandsController);

    /* @ngInject */
    function MDBCommandsController($rootScope, mdbService, $routeParams) {
        var vm = this;

        var qname = '/' + $routeParams['ss'];

        vm.qname = qname;
        vm.title = qname;
        vm.mdbType = 'commands';

        $rootScope.pageTitle = 'Commands | Yamcs';

        mdbService.listCommands({
            namespace: qname,
            recurse: (qname === '/yamcs')
        }).then(function (data) {
            vm.commands = data;
            return vm.commands;
        });
    }
})();

(function () {
    'use strict';

    MDBAlgorithmsController.$inject = ["$rootScope", "mdbService", "$routeParams"];
    angular
        .module('yamcs.mdb')
        .controller('MDBAlgorithmsController',  MDBAlgorithmsController);

    /* @ngInject */
    function MDBAlgorithmsController($rootScope, mdbService, $routeParams) {
        var vm = this;

        var qname = '/' + $routeParams['ss'];

        vm.qname = qname;
        vm.title = qname;
        vm.mdbType = 'algorithms';

        $rootScope.pageTitle = 'Algorithms | Yamcs';

        mdbService.listAlgorithms({
            namespace: qname,
            recurse: (qname === '/yamcs')
        }).then(function (data) {
            vm.algorithms = data;
            return vm.algorithms;
        });
    }
})();

(function() {
    'use strict';

    MDBAlgorithmDetailController.$inject = ["$rootScope", "$routeParams", "mdbService"];
    angular
        .module('yamcs.mdb')
        .controller('MDBAlgorithmDetailController', MDBAlgorithmDetailController);

    /* @ngInject */
    function MDBAlgorithmDetailController($rootScope, $routeParams, mdbService) {
        var vm = this;
        $rootScope.pageTitle = $routeParams.name + ' | Yamcs';

        var urlname = '/' + $routeParams['ss'] + '/' + $routeParams.name;
        vm.urlname = urlname;

        mdbService.getAlgorithmInfo(urlname).then(function (data) {
            vm.info = data;
            return vm.info;
        });
    }
})();

(function() {
    'use strict';

    ValueEnumerationModalInstanceController.$inject = ["$scope", "$uibModalInstance", "info"];
    angular
        .module('yamcs.mdb').controller('ValueEnumerationModalInstanceController', ValueEnumerationModalInstanceController);

    /* @ngInject */
    function ValueEnumerationModalInstanceController($scope, $uibModalInstance, info) {
        $scope.info = info;

        $scope.close = function () {
          $uibModalInstance.close();
        };
    }
})();

(function() {
    'use strict';

    AddParameterModalInstanceController.$inject = ["$scope", "$uibModalInstance", "mdbService"];
    angular
        .module('yamcs.mdb').controller('AddParameterModalInstanceController', AddParameterModalInstanceController);

    /* @ngInject */
    function AddParameterModalInstanceController($scope, $uibModalInstance, mdbService) {
        mdbService.listParameters().then(function(parameters) {
            $scope.parameters = parameters;
        });

        $scope.close = function () {
          $uibModalInstance.close();
        };

        $scope.ok = function () {
            /*alarmsService.patchParameterAlarm(alarm['triggerValue']['id'], alarm['seqNum'], {
                state: 'acknowledged',
                comment: form.comment
            });*/
            $uibModalInstance.close($scope.form);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };

        $scope.data = { chosenParameters: []};
    }
})();

(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.events', [])
        .config(configure);

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.when('/:instance/events', {
            templateUrl: '/_static/_site/events/pages/events.html',
            controller: 'EventsController',
            controllerAs: 'vm'
        });
    }
})();

(function () {
    'use strict';

    EventsController.$inject = ["$rootScope", "$scope", "$log", "eventsService"];
    angular
        .module('yamcs.events')
        .controller('EventsController',  EventsController);

    /* @ngInject */
    function EventsController($rootScope, $scope, $log, eventsService) {
        var vm = this;
        eventsService.resetUnreadCount(); // Poor man's solution

        $rootScope.pageTitle = 'Events | Yamcs';

        $scope.ctx = {
            loadingMoreData: false
        };

        $scope.loadMoreEvents = function() {
            if (!vm.events.length || $scope.ctx.loadingMoreData) return;
            $scope.ctx.loadingMoreData = true;

            var finalEvent = vm.events[vm.events.length - 1];
            console.log('loading more data from ' + finalEvent['generationTimeUTC']);

            eventsService.listEvents({
                limit: 20,
                stop: finalEvent['generationTimeUTC']
            }).then(function (data) { // todo check when end is reached, to prevent further triggers
                vm.events.push.apply(vm.events, data);
                $scope.ctx.loadingMoreData = false;
                return vm.events;
            });
        };


        vm.events = [];
        eventsService.listEvents().then(function (data) {
            vm.events = data;
            return vm.events;
        });

        $rootScope.$on('yamcs.eventStats', function(evt, stats) {
            vm.stats = stats;
        });

        vm.reloadData = function() {
            eventsService.resetUnreadCount(); // Not waterproof
            eventsService.listEvents({
                limit: 200
            }).then(function (data) {
                vm.events = data;
                return vm.events;
            });
        };

        vm.severityToggles = {
            info: true,
            warning: true,
            error: true
        };

        vm.searchText = '';
        vm.filterTable = function(event) {
            var severityMatch = false;
            if (event['severity'] === 'INFO') {
                severityMatch = vm.severityToggles.info;
            } else if (event['severity'] === 'WARNING') {
                severityMatch = vm.severityToggles.warning;
            } else if (event['severity'] === 'ERROR') {
                severityMatch = vm.severityToggles.error;
            } else {
                $log.info('Unexpected event severity ' + event['severity']);
            }

            if (!severityMatch) return false;
            if (!vm.searchText) return true;
            var re = new RegExp(vm.searchText.trim().replace('*', '.*'), 'i');
            return re.test(event['message']) || re.test(event['source']) || re.test(event['type']);
        };
    }
})();

(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.displays', ['yamcs.core', 'yamcs.uss'])
        .directive('displaysPane', displaysPane)
        .config(configure);

    /* @ngInject */
    function displaysPane() {
        return {
            restrict: 'E',
            transclude: true,
            scope: {
                activePane: '@',
                headerTitle: '@',
                yamcsInstance: '=',
                standalone: '=',
                shell: '='
            },
            templateUrl: '/_static/_site/displays/displays.template.html'
        };
    }

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.when('/:instance/displays', {
            templateUrl: '/_static/_site/displays/pages/displays.html',
            controller: 'DisplaysController',
            controllerAs: 'vm'
        }).when('/:instance/displays/:display*', {
            templateUrl: '/_static/_site/displays/pages/display.html',
            controller: 'DisplayController',
            controllerAs: 'vm'
        });
    }
})();

(function () {
    DisplaysController.$inject = ["$rootScope", "displaysService"];
    angular
        .module('yamcs.displays')
        .controller('DisplaysController',  DisplaysController);

    /* @ngInject */
    function DisplaysController($rootScope, displaysService) {
        var vm = this;

        $rootScope.pageTitle = 'Displays | Yamcs';

        vm.displays = [];
        displaysService.listDisplays().then(function (data) {
            vm.displays = data;
            return vm.displays;
        });
    }
})();

(function () {
    DisplayController.$inject = ["$rootScope", "$routeParams", "$scope"];
    angular
        .module('yamcs.displays')
        .controller('DisplayController', DisplayController);

    /* @ngInject */
    function DisplayController($rootScope, $routeParams, $scope) {
        var vm = this;

        var displayName = $routeParams.display;

        $rootScope.pageTitle = displayName + ' | Yamcs';
        vm.displayName = displayName;

        $scope.$on('$destroy', function() {
            console.log('destroy on display');
        });
    }
})();

(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.alarms', [])
        .config(configure);

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.when('/:instance/alarms', {
            templateUrl: '/_static/_site/alarms/pages/alarms.html',
            controller: 'AlarmsController',
            controllerAs: 'vm'
        });
        $routeProvider.when('/:instance/alarms/archive', {
            templateUrl: '/_static/_site/alarms/pages/archived-alarms.html',
            controller: 'ArchivedAlarmsController',
            controllerAs: 'vm'
        });
    }
})();

(function () {
    'use strict';

    ArchivedAlarmsController.$inject = ["$rootScope", "alarmsService"];
    angular
        .module('yamcs.alarms')
        .controller('ArchivedAlarmsController',  ArchivedAlarmsController);

    /* @ngInject */
    function ArchivedAlarmsController($rootScope, alarmsService) {
        $rootScope.pageTitle = 'Archived Alarms | Yamcs';

        var vm = this;
        vm.alarmTab = 'archivedAlarms';

        // Alarms sorted by key. Combines state of realtime and history
        vm.alarms = [];
        alarmsService.listAlarms().then(function (alarms) {
            vm.alarms = alarms;
        });

        vm.searchText = '';
        vm.filterTable = function(value) {
            if (!vm.searchText) return true;
            var qname = value['triggerValue']['id']['name'];
            var regex = new RegExp(vm.searchText.trim().replace('*', '.*'), 'i');
            return regex.test(qname);
        };

        vm.expandAlarms = function() {
            for (var i = 0; i < vm.alarms.length; i++) {
                vm.alarms[i].expanded = true;
            }
        };

        vm.collapseAlarms = function() {
            for (var i = 0; i < vm.alarms.length; i++) {
                vm.alarms[i].expanded = false;
            }
        };
    }
})();

(function () {
    'use strict';

    AlarmsController.$inject = ["$rootScope", "alarmsService", "$uibModal", "$log"];
    AcknowledgeAlarmModalController.$inject = ["$scope", "$uibModalInstance", "alarm", "form", "alarmsService"];
    angular
        .module('yamcs.alarms')
        .controller('AlarmsController',  AlarmsController)
        .controller('AcknowledgeAlarmModalController',  AcknowledgeAlarmModalController);

    /* @ngInject */
    function AlarmsController($rootScope, alarmsService, $uibModal, $log) {
        $rootScope.pageTitle = 'Alarms | Yamcs';

        var vm = this;


        vm.openAcknowledge = openAcknowledge; // Opens the acknowledge dialog
        vm.alarmTab = 'activeAlarms';
        vm.alarms = alarmsService.getActiveAlarms(); // Live collection

        function openAcknowledge(alarm) {
            var form = {
                comment: undefined
            };
            var modalInstance = $uibModal.open({
              animation: true,
              templateUrl: 'acknowledgeAlarmModal.html',
              controller: 'AcknowledgeAlarmModalController',
              size: 'lg',
              resolve: {
                alarm: function () {
                    return alarm;
                },
                form: function () {
                    return form;
                }
              }
            });

            modalInstance.result.then(function() {
                console.log('closed form is ', form);
            }, function () {
                $log.info('Modal dismissed at: ' + new Date());
            });
        }
    }

    /* @ngInject */
    function AcknowledgeAlarmModalController($scope, $uibModalInstance, alarm, form, alarmsService) {
        $scope.alarm = alarm;
        $scope.form = form;

        $scope.ok = function () {
            alarmsService.patchParameterAlarm(alarm['triggerValue']['id'], alarm['seqNum'], {
                state: 'acknowledged',
                comment: form.comment
            });
            $uibModalInstance.close($scope.form);
        };

        $scope.cancel = function () {
            $uibModalInstance.dismiss('cancel');
        };
    }
})();

(function() {
    'use strict';

    angular
        .module('yamcs.uss', []);
})();

(function () {
    'use strict';

    angular
        .module('yamcs.uss')
        .factory('ussService', ussService);

    /* @ngInject */
    function ussService() {

        return {
            drawDisplay: drawDisplay
        };

        function drawDisplay(sourceCode, targetDiv, doneFunction) {
            $(targetDiv).svg({onLoad: function () {
                var display = new USS.Display(targetDiv);
                display.parseAndDraw(sourceCode);
                if (doneFunction) doneFunction(display);
            }});
        }
    }
})();

(function () {
    'use strict';

    angular.module('yamcs.mdb')
        .directive('mdbPane', function () {
            return {
                restrict: 'E',
                transclude: true,
                scope: {
                    activePane: '@',
                    yamcsInstance: '=',
                    standalone: '=',
                    shell: '='
                },
                templateUrl: '/_static/_site/mdb/mdb.template.html'
            };
    });
})();

(function () {
    'use strict';

    MDBTemplateController.$inject = ["mdbService"];
    angular
        .module('yamcs.mdb')
        .controller('MDBTemplateController',  MDBTemplateController);

    /* @ngInject */
    function MDBTemplateController(mdbService) {
        var vm = this;

        mdbService.getSummary().then(function (mdb) {
            vm.mdb = mdb;
            return vm.mdb;
        });
    }
})();

(function() {
    'use strict';

    angular
        .module('yamcs.intf', [])
        .run(["alarmsService", "eventsService", "timeService", function (alarmsService, eventsService, timeService) {
            // Eagerly loading these injected services, to get the subscriptions running
            // Perhaps should research whether we should use angular providers instead.
        }]);
})();

(function () {
    angular.module('yamcs.intf')

    /*
        Returns true if the value string is part of the same XTCE space/sub system
        base on qualified names.
     */
    .filter('sameSpaceSystem', function () {
        return function (value, otherValue) {
            if (!value || !otherValue) return false;
            var a = value.slice(0, value.lastIndexOf('/'));
            var b = otherValue.slice(0, otherValue.lastIndexOf('/'));
            return a === b;
        };
    })

    /*
        Returns the space system for the fully qualified XTCE name
     */
    .filter('spaceSystem', function () {
        return function (value) {
            if (!value) return '';
            return value.slice(0, value.lastIndexOf('/'));
        };
    })

    /*
        Returns the short name for the given fully qualified XTCE name
     */
    .filter('name', function () {
        return function (value) {
            if (!value) return '';
            return value.slice(value.lastIndexOf('/')+ 1);
        };
    })

    /*
        Outputs the string value of a pval
     */
    .filter('stringValue', function () {
        return function (param, usingRaw) {
            if (!param) return '';
            if(usingRaw) {
                var rv = param.rawValue;
                if (rv === undefined) {
                    return '';
                }
                var res = '';
                if (rv['type'] === 'STRING') res += '\'';
                for(var idx in rv) {
                    if(idx!='type') res += rv[idx];
                }
                if (rv['type'] === 'STRING') res += '\'';
                return res;
            } else {
                var ev=param.engValue;
                if(ev === undefined) {
                    console.log('got parameter without engValue: ', param);
                    return null;
                }
                switch(ev.type) {
                    case 'FLOAT':
                        return ev.floatValue;
                    case 'DOUBLE':
                        return ev.doubleValue;
                    case 'BINARY':
                        return window.atob(ev.binaryValue);
                }
                for(var idx in ev) {
                    if(idx!='type') return ev[idx];
                }
            }
        };
    })

    /*
        Outputs an up- or down-pointing arrow if the monitoring result of the monitoring result is LOW or HIGH
     */
    .filter('lohi', function() {
        return function (rangeCondition) {
            if (!rangeCondition) return '';
            switch (rangeCondition) {
                case 'LOW':
                    return ' (low)';
                    //return '<small><span class="glyphicon glyphicon-arrow-down"></span></small>';
                case 'HIGH':
                    return ' (high)';
                    //return '<small><span class="glyphicon glyphicon-arrow-up"></span></small>';
                default:
                    return '';
            }
        }
    })

    /*
        Replaces the input value with the replacemet if it is not set
     */
    .filter('nvl', function () {
        return function (value, replacement) {
            if (value === undefined || value === null) {
                return replacement;
            } else {
                return value;
            }
        };
    })

    /*
        Converts monitoringResult to a twitter bootstrap class
     */
    .filter('monitoringClass', function () {
        return function (monitoringResult) {
            if (!monitoringResult) return '';
            switch (monitoringResult) {
                case 'WATCH':
                case 'WARNING':
                case 'DISTRESS':
                case 'CRITICAL':
                case 'SEVERE':
                    return 'danger';
                case 'IN_LIMITS':
                    return 'success';
                default:
                    return 'default';
            }
        };
    })

    /*
        Converts monitoringResult to a twitter bootstrap class
     */
    .filter('monitoringValue', function () {
        return function (monitoringResult) {
            if (!monitoringResult) return '';
            switch (monitoringResult) {
                case 'WATCH': return 'Watch';
                case 'WARNING': return 'Warning';
                case 'DISTRESS': return 'Distress';
                case 'CRITICAL': return 'Critical';
                case 'SEVERE': return 'Severe';
                case 'IN_LIMITS': return 'In Limits';
                default: console.log('should handle value ' + monitoringResult); return '';
            }
        };
    })

    /*
        Converts monitoringResult to a numeric 0-5 severity level
     */
    .filter('monitoringLevel', function () {
        return function (monitoringResult) {
            if (!monitoringResult) return 0;
            switch (monitoringResult) {
                case 'WATCH':
                    return 1;
                case 'WARNING':
                    return 2;
                case 'DISTRESS':
                    return 3;
                case 'CRITICAL':
                    return 4;
                case 'SEVERE':
                    return 5;
                default:
                    return 0;
            }
        };
    })

    /*
        Converts the MDB operator type
     */
    .filter('asOperator', function () {
        return function (value) {
            if (!value) return '';
            switch (value) {
                case 'EQUAL_TO':
                    return '==';
                case 'NOT_EQUAL_TO':
                    return '!=';
                case 'GREATER_THAN':
                    return '>';
                case 'GREATER_THAN_OR_EQUAL_TO':
                    return '>=';
                case 'SMALLER_THAN':
                    return '<';
                case 'SMALLER_THAN_OR_EQUAL_TO':
                    return '<=';
                default:
                    return '??';
            }
        };
    });
})();

(function () {
    'use strict';

    tmService.$inject = ["$http", "$log", "$rootScope", "socket", "yamcsInstance", "remoteConfig"];
    angular.module('yamcs.intf').factory('tmService', tmService);

    /* @ngInject */
    function tmService($http, $log, $rootScope, socket, yamcsInstance, remoteConfig) {

        socket.on('PARAMETER', function(pdata) {
            var params = pdata['parameter'];
            $rootScope.$broadcast('yamcs.tm.pvals', params);
        });

        return {
            getParameter: getParameter,
            getParameterSamples: getParameterSamples,
            getParameterHistory: getParameterHistory,
            subscribeParameters: subscribeParameters,
            subscribeComputations: subscribeComputations
        };

        function getParameter(qname, options) {
            var targetUrl = '/api/processors/' + yamcsInstance + '/realtime/parameters' + qname;
            targetUrl += toQueryString(options);
            return $http.get(targetUrl).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function getParameterSamples(qname, options, canceler) {
            if(!!remoteConfig['useParameterArchive']) {
                var targetUrl = '/api/archive/' + yamcsInstance + '/parameters2' + qname + '/samples';
            } else {
                var targetUrl = '/api/archive/' + yamcsInstance + '/parameters' + qname + '/samples';
            }
            targetUrl += toQueryString(options);
            var ngOpts = {};
            if (canceler) {
                ngOpts['timeout'] = canceler.promise;
            }
            return $http.get(targetUrl, ngOpts).then(function (response) {
                return response.data;
            }).catch(function (message) {
                if (message['data']) {
                    $log.error('XHR failed', message);
                    throw messageToException(message);
                } else {
                    $log.info('Canceled a pending request');
                }
            });
        }

        function getParameterHistory(qname, options) {
            if(!!remoteConfig['useParameterArchive']) {
                var targetUrl = '/api/archive/' + yamcsInstance + '/parameters2' + qname;
            } else {
                var targetUrl = '/api/archive/' + yamcsInstance + '/parameters' + qname;
            }
            targetUrl += toQueryString(options);
            return $http.get(targetUrl).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }
        function subscribeParameters(parameters) {
            if (parameters.length == 0) return;
            var msg = {
                abortOnInvalid: false,
                id: parameters
            };

            socket.on('open', function () {
                socket.emit('parameter', 'subscribe2', msg);
            });
            if (socket.isConnected()) {
                socket.emit('parameter', 'subscribe2', msg);
            }
        }

        function subscribeComputations(computations) {
            if(computations.length == 0) return;
            var msg = {
                abortOnInvalid: false,
                computations: computations
            };

            socket.on('open', function () {
                socket.emit('parameter', 'subscribeComputations', msg);
            });
            if (socket.isConnected()) {
                socket.emit('parameter', 'subscribeComputations', msg);
            }
        }

        function toQueryString(options) {
            if (!options) return '?nolink&pretty=no';
            var result = '?nolink&pretty=no';
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    result += '&' + opt + '=' + options[opt];
                }
            }
            return result;
        }

        function messageToException(message) {
            return {
                name: message['data']['type'],
                message: message['data']['msg']
            };
        }

        function idsMatch(a, b) {
            var aHas = a.hasOwnProperty('namespace');
            var bHas = b.hasOwnProperty('namespace');
            if (aHas !== bHas) {
                return false;
            } else if (aHas) {
                return (a.name === b.name) && (a.namespace === b.namespace);
            } else {
                return (a.name === b.name);
            }
        }
    }
})();

(function () {
    'use strict';

    timeService.$inject = ["socket", "$rootScope"];
    angular
        .module('yamcs.intf')
        .factory('timeService', timeService);

    /* @ngInject */
    function timeService(socket, $rootScope) {

        var latestTime;

        socket.on('open', function () {
            subscribeUpstream();
        });
        if (socket.isConnected()) {
            subscribeUpstream();
        }

        return {
        };

        function subscribeUpstream() {
            socket.on('TIME_INFO', function (data) {
                latestTime = data;
                $rootScope.$broadcast('yamcs.time', latestTime);
            });
            socket.emit('time', 'subscribe', {}, null, function (et, msg) {
                console.log('failed subscribe', et, ' ', msg);
            });
        }
    }
})();

(function () {
    'use strict';

    /*
     * Web Socket Protocol Handling.
     * Each message sent is a list [1=protoversion, 1=request, request id, request object]
     * The message received back has to contain the same id and can be of type reply or exception
     */

    WebSocketClient.$inject = ["$rootScope", "$log", "yamcsInstance"];
    angular
        .module('yamcs.intf')
        .factory('socket', WebSocketClient);

    var PROTOCOL_VERSION = 1;
    var MESSAGE_TYPE_REQUEST = 1;
    var MESSAGE_TYPE_REPLY = 2;
    var MESSAGE_TYPE_EXCEPTION = 3;
    var MESSAGE_TYPE_DATA = 4;

    var requestSeqCount = -1;
    var wsproto = "ws";
    if (location.protocol == 'https:') {
        wsproto = "wss"
    }

    var dataCallbacks = {};
    var exceptionHandlers = {};
    var replyHandlers = {};

    var conn;

    /* @ngInject */
    function WebSocketClient($rootScope, $log, yamcsInstance) {
        $log.info('connecting websocket');

        conn = new WebSocket(wsproto+'://'+location.host+'/'+yamcsInstance+'/_websocket');
        conn.onmessage = function(msg) {
            var json = JSON.parse(msg.data);

            switch(json[1]) {
            case MESSAGE_TYPE_REPLY:
                //$log.info('get back reply', json);
                dispatchReply(json[2], json[3]);
                break;
            case MESSAGE_TYPE_EXCEPTION:
                //$log.error('get back exc', json);
                dispatchException(json[2], json[3]);
                break;
            case MESSAGE_TYPE_DATA:
                var data=json[3];
                dispatchData(data.dt, data.data);
                break;
            }
        };
        conn.onclose = function (event) {
            $log.error('websocket closed');
            dispatchData('close', event);
        };
        conn.onopen = function () {
            //$log.success('websocket open');
            dispatchData('open', null);

            $rootScope.$apply(function () {
                $rootScope.wsconnected = true;
            });
        };

        return {
            on: function (eventName, callback) {
                dataCallbacks[eventName] = dataCallbacks[eventName] || [];
                dataCallbacks[eventName].push(function (message) {
                    $rootScope.$apply(function () {
                        callback(message);
                    });
                });
                //return this;// chainable
            },
            emit: function (resource, request, data, replyHandler, exceptionHandler) {
                requestSeqCount++;
                if (replyHandler) {
                    replyHandlers[requestSeqCount] = replyHandler;
                }
                if (exceptionHandler) {
                    exceptionHandlers[requestSeqCount] = exceptionHandler;
                }
                var t = {};
                t[resource] = request;
                t['data'] = data;
                var payload = JSON.stringify([
                    PROTOCOL_VERSION,
                    MESSAGE_TYPE_REQUEST,
                    requestSeqCount,
                    t //{request: request, data: data}
                ]);
                conn.send(payload);
                //return this;
            },
            isConnected: function () {
                return conn.readyState == WebSocket.OPEN;
            }
        };
    }

    function dispatchException(requestId, data) {
        var h = exceptionHandlers[requestId];
        delete exceptionHandlers[requestId];
        delete replyHandlers[requestId];

        if (h === undefined) {
            console.log("Exception received for request id "+requestId+", and no handler available. Exception data: ", data);
            return;
        }
        h(data.et, data.msg);
    }

   function dispatchReply(requestId, data) {
       var h = replyHandlers[requestId];
       delete exceptionHandlers[requestId];
       delete replyHandlers[requestId];

       if (h === undefined)  return;
       h(data);
    }

    function dispatchData(eventName, message) {
        var chain = dataCallbacks[eventName];
        if (chain == undefined) return; // no callbacks for this event

        for (var i = 0; i < chain.length; i++) {
            chain[i](message);
        }
    }
})();

(function () {
    'use strict';

    mdbService.$inject = ["$http", "$log", "yamcsInstance"];
    angular
        .module('yamcs.intf')
        .factory('mdbService', mdbService);

    /* @ngInject */
    function mdbService($http, $log, yamcsInstance) {

        return {
            getSummary: getSummary,

            listParameters: listParameters,
            getParameterInfo: getParameterInfo,

            listContainers: listContainers,

            listCommands: listCommands,

            listAlgorithms: listAlgorithms,
            getAlgorithmInfo: getAlgorithmInfo
        };

        function getSummary() {
            var targetUrl = '/api/mdb/' + yamcsInstance;

            return $http.get(targetUrl).then(function (response) {
                var mdb = response.data;
                mdb['flatSpaceSystems'] = []; // Flatten the nested structure, for better UI
                if (mdb.hasOwnProperty('spaceSystem')) {
                    for (var i = 0; i < mdb['spaceSystem'].length; i++) {
                        var ss = mdb['spaceSystem'][i];
                        if (ss['qualifiedName'] === '/yamcs') {
                            var compacted = compactSpaceSystem(ss);
                            mdb['flatSpaceSystems'].push(compacted);
                        } else {
                            var flattened = flattenSpaceSystem(ss);
                            for (var j = 0; j < flattened.length; j++) {
                                mdb['flatSpaceSystems'].push(flattened[j]);
                            }
                        }
                    }
                }
                return mdb;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function listParameters(options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/parameters';
            targetUrl += toQueryString(options);

            return $http.get(targetUrl).then(function (response) {
                return response.data['parameter'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function listContainers(options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/containers';
            targetUrl += toQueryString(options);

            return $http.get(targetUrl).then(function (response) {
                return response.data['container'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function listCommands(options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/commands';
            targetUrl += toQueryString(options);

            return $http.get(targetUrl).then(function (response) {
                return response.data['command'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function listAlgorithms(options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/algorithms';
            targetUrl += toQueryString(options);

            return $http.get(targetUrl).then(function (response) {
                return response.data['algorithm'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function getParameterInfo(urlname, options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/parameters' + urlname;
            targetUrl += toQueryString(options);
            return $http.get(targetUrl).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function getAlgorithmInfo(urlname, options) {
            var targetUrl = '/api/mdb/' + yamcsInstance + '/algorithms' + urlname;
            targetUrl += toQueryString(options);
            return $http.get(targetUrl).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        /*
            Returns an array of a space system and all of its nested children
         */
        function flattenSpaceSystem(ss) {
            var flattened = [ ss ];
            if (ss.hasOwnProperty('sub')) {
                for (var i = 0; i < ss.sub.length; i++) {
                    var flatsub = flattenSpaceSystem(ss.sub[i]);
                    for (var j = 0; j < flatsub.length; j++) {
                        flattened.push(flatsub[j]);
                    }
                }
            }
            return flattened;
        }

        /*
            Returns a single space system, with all nested elements attached directly to it
         */
        function compactSpaceSystem(ss) {
            if (ss.hasOwnProperty('sub')) {
                for (var i = 0; i < ss.sub.length; i++) {
                    var flatsub = flattenSpaceSystem(ss.sub[i]);
                    for (var j = 0; j < flatsub.length; j++) {
                        ss['parameterCount'] += flatsub[j]['parameterCount'];
                        ss['containerCount'] += flatsub[j]['containerCount'];
                        ss['commandCount'] += flatsub[j]['commandCount'];
                        ss['algorithmCount'] += flatsub[j]['algorithmCount'];
                    }
                }
            }
            return ss;
        }

        function toQueryString(options) {
            if (!options) return '?nolink';
            var result = '?nolink';
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    result += '&' + opt + '=' + options[opt];
                }
            }
            return result;
        }

        function messageToException(message) {
            return {
                name: message['data']['type'],
                message: message['data']['msg']
            };
        }
    }
})();

(function () {
    'use strict';

    eventsService.$inject = ["$rootScope", "$http", "socket", "yamcsInstance"];
    angular
        .module('yamcs.intf')
        .factory('eventsService', eventsService);

    /* @ngInject */
    function eventsService($rootScope, $http, socket, yamcsInstance) {

        var stats = {
            unreadCount: 0, // well, sort of
            urgent: false
        };

        socket.on('open', function () {
            subscribeUpstream();
        });
        if (socket.isConnected()) {
            subscribeUpstream();
        }

        return {
            getEvents: getEvents,
            listEvents: listEvents,
            resetUnreadCount: resetUnreadCount
        };

        function getEvents() {
            return events;
        }

        function listEvents(options) {
            var targetUrl = '/api/archive/' + yamcsInstance + '/events';
            targetUrl += toQueryString(options);
            return $http.get(targetUrl).then(function (response) {
                return response.data['event'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function resetUnreadCount() {
            stats.unreadCount = 0;
            stats.urgent = false;
            $rootScope.$broadcast('yamcs.eventStats', stats);
        }

        function subscribeUpstream() {
            socket.on('EVENT', function (data) {
                stats.unreadCount++;
                if (data['severity'] === 'ERROR') {
                    stats.urgent = true;
                }
                $rootScope.$broadcast('yamcs.eventStats', stats);
                $rootScope.$broadcast('yamcs.event', data);
            });
            socket.emit('events', 'subscribe', {}, null, function (et, msg) {
                console.log('failed subscribe', et, ' ', msg);
            });
        }

        function toQueryString(options) {
            if (!options) return '?nolink';
            var result = '?nolink';
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    result += '&' + opt + '=' + options[opt];
                }
            }
            return result;
        }

        function messageToException(message) {
            return {
                name: message['data']['type'],
                message: message['data']['msg']
            };
        }
    }
})();

(function () {
    displaysService.$inject = ["$http", "$log", "yamcsInstance"];
    angular
        .module('yamcs.intf')
        .factory('displaysService', displaysService);

    /* @ngInject */
    function displaysService($http, $log, yamcsInstance) {

        return {
            listDisplays: listDisplays,
            getDisplay: getDisplay
        };

        function listDisplays() {
            var targetUrl = '/api/displays/' + yamcsInstance;
            return $http.get(targetUrl, {cache: true}).then(function (response) {
                var data = response.data;
                // Array of arrays, but translate it for easier processing
                var displays = [];
                for (var i = 0; i < data.length; i++) {
                    displays.push(addDisplay('', data[i]));
                }
                return displays;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function getDisplay(filename) {
            var targetUrl = '/_static/' + yamcsInstance + '/displays/' + filename;
            return $http.get(targetUrl, {
                cache: true,
                transformResponse : function(data) {
                    return $.parseXML(data);
                }
            }).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function addDisplay(path, d) {
            if (d instanceof Array) {
                var group = { 'group': d[0], 'displays': [] };
                for (var i = 1; i < d.length; i++) {
                    var d1 = d[i];
                    var child = addDisplay(path + d[0] + '/', d1);
                    group['displays'].push(child);
                }
                return group;
            } else {
                return { 'name': d, 'display': path + d };
            }
        }

        function messageToException(message) {
            return {
                name: message['data']['type'],
                message: message['data']['msg']
            };
        }
    }
})();

(function () {
    'use strict';

    alarmsService.$inject = ["$rootScope", "$http", "$log", "socket", "yamcsInstance"];
    angular
        .module('yamcs.intf')
        .factory('alarmsService', alarmsService);

    // Aggregated alarm data
    var activeAlarms = [];

    /* @ngInject */
    function alarmsService($rootScope, $http, $log, socket, yamcsInstance) {

        var stats = {
            activeCount: 0,
            urgent: false
        };

        socket.on('open', function () {
            subscribeUpstream();
        });
        if (socket.isConnected()) {
            subscribeUpstream();
        }

        return {
            getKey: getKey,
            getActiveAlarms: getActiveAlarms,
            getActiveAlarmForParameter: getActiveAlarmForParameter,
            listAlarms: listAlarms,
            listAlarmsForParameter: listAlarmsForParameter,
            patchParameterAlarm: patchParameterAlarm
        };

        /**
         * Returns a singular value combining the effective key of an alarm:
         * (triggerTime, parameter, seqnum)
         */
        function getKey(alarm) {
            var triggerTime = alarm['triggerValue']['generationTime'];
            var qname = alarm['triggerValue']['id']['name'];
            return triggerTime + qname + alarm['seqNum'];
        }

        /**
         * Active alarms sorted by key
         */
        function getActiveAlarms() {
            return activeAlarms;
        }

        function getActiveAlarmForParameter(qname) {
            for (var i = 0; i < activeAlarms.length; i++) {
                if (activeAlarms[i]['triggerValue']['id']['name'] === qname) {
                    return activeAlarms[i];
                }
            }
        }

        function listAlarms() {
            var targetUrl = '/api/archive/' + yamcsInstance + '/alarms';
            return $http.get(targetUrl).then(function (response) {
                var alarms = [];
                if (response.data.hasOwnProperty('alarm')) {
                    for (var i = 0; i < response.data['alarm'].length; i++) {
                        var alarm = enrichAlarm(response.data['alarm'][i]);
                        var stillOngoing = false;
                        for (var j = 0; j < activeAlarms.length; j++) {
                            if (activeAlarms[j]['key'] === alarm['key']) {
                                stillOngoing = true;
                                break;
                            }
                        }
                        if (!stillOngoing) {
                            alarms.push(alarm);
                        }
                    }
                }
                return alarms;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function listAlarmsForParameter(qname) {
            var targetUrl = '/api/archive/' + yamcsInstance + '/alarms' + qname;
            return $http.get(targetUrl).then(function (response) {
                if (response.data.hasOwnProperty('alarm')) {
                    for (var i = 0; i < response.data['alarm'].length; i++) {
                        enrichAlarm(response.data['alarm'][i]);
                    }
                }
                return response.data['alarm'];
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function subscribeUpstream() {
            socket.on('ALARM_DATA', function (data) {
                data = enrichAlarm(data);
                if (data['type'] === 'CLEARED') {
                    for (var i = 0; i < activeAlarms.length; i++) {
                        if (activeAlarms[i]['key'] === data['key']) {
                            activeAlarms.splice(i, 1);
                            break;
                        }
                    }
                } else {
                    var match = false;
                    for (var i = 0; i < activeAlarms.length; i++) {
                        if (activeAlarms[i]['key'] === data['key']) {
                            activeAlarms[i] = data;
                            match = true;
                            break;
                        }
                    }
                    if (!match) {
                        var insertIndex = _.sortedIndex(activeAlarms, data, 'key');
                        activeAlarms.splice(insertIndex, 0, data);
                    }
                }

                updateStats();
                $rootScope.$broadcast('yamcs.alarm', data);
            });

            socket.emit('alarms', 'subscribe', {}, null, function (et, msg) {
                console.log('failed subscribe', et, ' ', msg);
            });
        }

        function patchParameterAlarm(parameterId, alarmId, options) {
            var targetUrl = '/api/processors/' + yamcsInstance + '/realtime/parameters' + parameterId.name + '/' + 'alarms/' + alarmId;
            return $http.patch(targetUrl, options).then(function (response) {
                return response.data;
            }).catch(function (message) {
                $log.error('XHR failed', message);
                throw messageToException(message);
            });
        }

        function updateStats() {
            var urgent = false;
            for (var i = 0; i < activeAlarms.length; i++) {
                if (!activeAlarms[i].hasOwnProperty('acknowledgeInfo')) {
                    urgent = true;
                    break;
                }
            }
            stats['activeCount'] = activeAlarms.length;
            stats['urgent'] = urgent;
            $rootScope.$broadcast('yamcs.alarmStats', stats);
        }

        function enrichAlarm(alarm) {
            alarm['key'] = getKey(alarm);
            alarm['triggerLevel'] = toNumericLevel(alarm['triggerValue']['monitoringResult']);
            if (alarm.hasOwnProperty('mostSevereValue')) {
                alarm['mostSevereLevel'] = toNumericLevel(alarm['mostSevereValue']['monitoringResult']);
            } else {
                alarm['mostSevereValue'] = alarm['triggerValue'];
                alarm['mostSevereLevel'] = alarm['triggerLevel'];
            }
            if (alarm.hasOwnProperty('currentValue')) {
                alarm['currentLevel'] = toNumericLevel(alarm['currentValue']['monitoringResult']);
            } else {
                alarm['currentValue'] = alarm['triggerValue'];
                alarm['currentLevel'] = alarm['triggerLevel'];
            }
            return alarm;
        }

        function toNumericLevel(monitoringResult) {
            switch (monitoringResult) {
            case 'WATCH':
                return 1;
            case 'WARNING':
                return 2;
            case 'DISTRESS':
                return 3;
            case 'CRITICAL':
                return 4;
            case 'SEVERE':
                return 5;
            default:
                return 0;
            }
        }

        function messageToException(message) {
            return {
                name: message['data']['type'],
                message: message['data']['msg']
            };
        }
    }
})();

(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.home', ['yamcs.displays'])
        .config(configure);

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.when('/:instance', {
            templateUrl: '/_static/_site/home/home.html',
            controller: 'HomeController',
            controllerAs: 'vm'
        });
    }
})();

(function () {
    HomeController.$inject = ["$rootScope", "configService", "displaysService"];
    angular
        .module('yamcs.home')
        .controller('HomeController',  HomeController);

    /* @ngInject */
    function HomeController($rootScope, configService, displaysService) {
        var vm = this;

        vm.appTitle = configService.get('title');
        $rootScope.pageTitle = vm.appTitle;

        vm.displays = [];
        displaysService.listDisplays().then(function (data) {
            vm.displays = data;
            return vm.displays;
        });
    }
})();

(function () {
    DisplaysTemplateController.$inject = ["displaysService"];
    angular
        .module('yamcs.displays')
        .controller('DisplaysTemplateController',  DisplaysTemplateController);

    /* @ngInject */
    function DisplaysTemplateController(displaysService) {
        var vm = this;
        vm.displays = [];
        displaysService.listDisplays().then(function (data) {
            vm.displays = data;
            return vm.displays;
        });
    }
})();

(function() {
    'use strict';

    /*
        The embedded display directive creates a display instance that holds its
        own state (bindings) in local angular scope.
        Currently still TODO is to unsubscribe in a way that would not impact
        potential other parallel subscriptions
     */
    displayDirective.$inject = ["displaysService", "tmService", "ussService"];
    angular.module('yamcs.displays').directive('display', displayDirective);

    /* @ngInject */
    function displayDirective(displaysService, tmService, ussService) {
        return {
            restrict: 'A',
            scope: { ref: '@' },
            link: function(scope, elem, attrs) {

                var displayWidget;

                if (!elem.data('spinner')) {
                    elem.data('spinner', new Spinner({color: '#ccc'}));
                }
                elem.data('spinner').spin(elem[0]);

                displaysService.getDisplay(attrs['ref']).then(function(sourceCode) {
                    ussService.drawDisplay(sourceCode, elem, function(display) {
                        displayWidget = display;

                        tmService.subscribeParameters(display.getParameters());
                        tmService.subscribeComputations(display.getComputations());

                        // 'Leak' canvas color
                        // This should not be done here. But I'm not yet fully understanding angular
                        // intricacities when it comes to scopes, directives and DOM manipulations.
                        //elem.parents('.main').css('background-color', display.bgcolor);
                        $('body').css('background-color', display.bgcolor);
                        elem.data('spinner').stop();
                    });
                });

                scope.$on('yamcs.tm.pvals', function(event, data) {
                    if (displayWidget) {
                        displayWidget.updateBindings(data);
                    }
                });

                scope.$on('$destroy', function() {
                    console.log('destroy on embedded display');

                    // Return intentionally leaked background color to the default
                    $('body').css('background-color', '');

                    // TODO
                    //unsubscribe
                });
            }
        }
    }
})();

(function() {
    'use strict';

    configure.$inject = ["$routeProvider"];
    angular
        .module('yamcs.core', [
            'ngAnimate', 'ngRoute', 'ngSanitize',
            'ui.bootstrap', 'infinite-scroll',
            'yamcs.intf'
        ])
        .config(configure);

    /* @ngInject */
    function configure($routeProvider) {
        $routeProvider.otherwise({
            templateUrl: '/_static/_site/core/404.html'
        });
    }
})();

(function() {
    'use strict';

    /**
     * Plot directive using dygraphs.
     *
     * Converts, holds and updates data and exposes control methods for use in a controller.
     * However it does NOT send out any data requests itself, instead relying on callbacks
     * that are sent back to a controller (e.g. zoom event).
     *
     * While this plot directive is currently used only in one controller, this explicit separation
     * is intended so that its use could eventually be extended to other places.
     */
    yPlot.$inject = ["$log", "$interval", "$filter", "configService"];
    angular.module('yamcs.core').directive('yPlot', yPlot);

    // Dygraphs does not have a nice hook that gets called on pan end (other than hacking it in onDrawCallback)
    // So modify their code...
    var origEndPan = Dygraph.Interaction.endPan;
    Dygraph.Interaction.endPan = function(event, g, context) {
        origEndPan(event, g, context);
        if (g.getFunctionOption('yamcs_panCallback')) {
            var xAxisRange = g.xAxisRange();
            var x1 = new Date(xAxisRange[0]);
            var x2 = new Date(xAxisRange[1]);
            g.getFunctionOption('yamcs_panCallback').call(g, x1, x2, g.yAxisRanges());
        }
    };
    Dygraph.endPan = Dygraph.Interaction.endPan;

    /* @ngInject */
    function yPlot($log, $interval, $filter, configService) {

        return {
            restrict: 'EA',
            scope: {
                pinfo: '=',
                samples: '=', // The complete set of samples (does not include zoom detail)
                alarms: '=',
                control: '=', // Optionally allows controlling this directive from the outside
                onZoom: '&',
                refresh: '@' // Interval at which to refresh the plot
            },
            link: function(scope, element, attrs) {
                var plotWrapper = angular.element('<div>');
                var spinContainer = angular.element('<div style="position: absolute; top: 50%; left: 50%;"></div>');
                plotWrapper.prepend(spinContainer);

                var plotEl = angular.element('<div style="width: 100%;"></div>');
                plotWrapper.prepend(plotEl);

                element.prepend(plotWrapper);

                // Dict holding latest averaged realtime (polled by refresher)
                var pendingRealtime;

                var model = {
                    hasData: false,
                    valueRange: [null, null],
                    spinning: false,
                    allPoints: [],
                    splicedPoints: [], // when the range is combined with a detail range
                    min_y: undefined,
                    max_y: undefined,
                    isRangeSelectorMouseDown: false
                };
                var g = makePlot(plotEl[0], scope, model);
                g.ready(function () {

                    /**
                     * Loads or reloads the full-range of data of the plot as provided
                     * by the controller.
                     */
                    scope.$watch(attrs.samples, function (samples) {
                        pendingRealtime = null;
                        if (samples) {
                            var pointData = convertSampleDataToDygraphs(samples);
                            model.allPoints = pointData[0].points;
                            model.splicedPoints = model.allPoints;
                            model.min_y = pointData[0].min;
                            model.max_y = pointData[0].max;
                        } else {
                            if (model.hasData) {
                                g.resetZoom();
                            }
                            model.allPoints = [];
                            model.splicedPoints = [];
                        }

                        model.hasData = model.allPoints.length > 0;
                        updateGraph(g, model);
                    });

                    /**
                     * Dygraphs does not have a nice hook for range selector, so force it
                     */
                    var rangeEl = plotEl.find('.dygraph-rangesel-fgcanvas, .dygraph-rangesel-zoomhandle');
                    var windowEl = $(window);
                    rangeEl.on('mousedown.yamcs touchstart.yamcs', function(evt) {
                        model.isRangeSelectorMouseDown = true;

                        // On up, load new detail data
                        windowEl.off('mouseup.yamcs touchend.yamcs');
                        windowEl.on('mouseup.yamcs touchend.yamcs', function(evt) {
                            windowEl.off('mouseup.yamcs touchend.yamcs');
                            model.isRangeSelectorMouseDown = false;
                            var xAxisRange = g.xAxisRange();
                            scope.onZoom({
                                startDate: new Date(xAxisRange[0]),
                                stopDate: new Date(xAxisRange[1])
                            });
                        });
                    });
                });

                // Refreshes if there are new realtime points
                var refresher = $interval(refreshPlot, attrs.refresh || 5000);
                scope.$on('$destroy', function() {
                    $interval.cancel(refresher);
                });

                scope.__control = scope.control || {};
                var spinner = new Spinner({color: '#ccc'});
                scope.__control.startSpinner = function() {
                    if (!model.spinning) {
                        model.spinning = true;
                        spinner.spin(spinContainer[0]);
                    }
                };
                scope.__control.stopSpinner = function () {
                    model.spinning = false;
                    spinner.stop();
                };
                scope.__control.repaint = function() {
                    updateGraph(g, model);
                };
                scope.__control.toggleGrid = function () {
                    if (g.getOption('drawGrid')) {
                        g.updateOptions({ drawGrid: false });
                    } else {
                        g.updateOptions({ drawGrid: true });
                    }
                };

                /**
                 * Averages incoming realtime. Picked up by the refresher at
                 * regular intervals.
                 */
                scope.__control.appendPoint = function(pval) {
                    if (pval && pval.hasOwnProperty('engValue')) {
                        var t = Date.parse(pval['generationTimeUTC']);
                        var val = $filter('stringValue')(pval);

                        if (pendingRealtime) {
                            var n = ++pendingRealtime['n'];
                            pendingRealtime['avgt'] -= pendingRealtime['avgt'] / n;
                            pendingRealtime['avgt'] += t / n;
                            pendingRealtime['avg'] -= pendingRealtime['avg'] / n;
                            pendingRealtime['avg'] += val / n;
                            pendingRealtime['min'] = Math.min(val, pendingRealtime['min']);
                            pendingRealtime['max'] = Math.max(val, pendingRealtime['max']);
                        } else {
                            pendingRealtime = {
                                avgt: t,
                                avg: val,
                                min: val,
                                max: val,
                                n: 1
                            }
                        }
                    }
                };

                /**
                 * Loads a subset of data for plot. Useful for resampling
                 * zoomed ranges. Currently discards any previously loaded detail
                 * in favour of new detail.
                 */
                scope.__control.spliceDetailSamples = function(detailSamples) {
                    if (!detailSamples) {
                        return;
                    }

                    // [ [t, [min, v, max]], [t, [min, v, max]], ...  ]
                    var allPoints = model.allPoints;
                    var detailPoints = convertSampleDataToDygraphs(detailSamples)[0].points;

                    if (detailPoints.length) {
                        var dt0 = detailPoints[0];
                        var dtn = detailPoints[detailPoints.length - 1];

                        // Search insert position by comparing on 't'
                        var insertStartIdx = _.sortedIndexBy(allPoints, dt0, function(v) { return v[0]; });
                        var insertStopIdx = _.sortedLastIndexBy(allPoints, dtn, function(v) { return v[0]; });

                        // Spliced
                        model.splicedPoints = [];
                        Array.prototype.push.apply(model.splicedPoints, allPoints.slice(0, insertStartIdx));
                        Array.prototype.push.apply(model.splicedPoints, detailPoints);
                        Array.prototype.push.apply(model.splicedPoints, allPoints.slice(insertStopIdx));

                        updateGraph(g, model);
                    }
                };

                scope.__control.initialized = true;

                function refreshPlot() {
                    if (!pendingRealtime) {
                        return;
                    }

                    var t = new Date();
                    t.setTime(pendingRealtime['avgt']);
                    var dypoint = [
                        t, [ pendingRealtime['min'], pendingRealtime['avg'], pendingRealtime['max']]
                    ];

                    //console.log('refresh plot from ' + pendingRealtime['n'] + ' points ... ', dypoint);
                    if (model.hasData) {
                        model.min_y = Math.min(model.min_y, dypoint[1][0]);
                        model.max_y = Math.max(model.max_y, dypoint[1][2]);
                    } else {
                        model.min_y = dypoint[1][0];
                        model.max_y = dypoint[1][2];
                    }
                    model.allPoints.push(dypoint);
                    if (model.splicedPoints.length > 0) {
                        model.splicedPoints.push(dypoint);
                    }
                    model.hasData = true;
                    pendingRealtime = null;
                    updateGraph(g, model);
                }
            }
        };

        function makePlot(containingDiv, scope, model) {
            model.valueRange = calculateInitialPlotRange(scope.pinfo);
            var guidelines = calculateGuidelines(scope.pinfo);
            var label = scope.pinfo['qualifiedName'];

            return new Dygraph(containingDiv, 'X\n', {
                legend: 'always',
                drawGrid: false,
                drawPoints: true,
                showRoller: false,
                customBars: true,
                strokeWidth: 2,
                gridLineColor: '#444',
                axisLineColor: '#333',
                axisLabelColor: '#666',
                axisLabelFontSize: 11,
                digitsAfterDecimal: 6,
                //panEdgeFraction: 0,
                labels: ['Generation Time', label],
                labelsDiv: 'parameter-detail-legend',
                showRangeSelector: true,
                rangeSelectorPlotStrokeColor: '#333',
                rangeSelectorPlotFillColor: '#008080',
                valueRange: model.valueRange,
                yRangePad: 10,
                axes: {
                    y: { axisLabelWidth: 50 }
                },
                rightGap: 0,
                labelsUTC: configService.get('utcOnly', false),
                zoomCallback: function(minDate, maxDate) {
                    // Dragging range handles causes many-many zoomCallbacks
                    if (!model.isRangeSelectorMouseDown) {
                        scope.onZoom({ // Report to controller
                            startDate: new Date(minDate),
                            stopDate: new Date(maxDate)
                        });
                    }
                },
                yamcs_panCallback: function(minDate, maxDate) {
                    // Dragging range handles causes many-many zoomCallbacks
                    if (!model.isRangeSelectorMouseDown) {
                        scope.onZoom({ // Report to controller
                            startDate: new Date(minDate),
                            stopDate: new Date(maxDate)
                        });
                    }
                },
                drawHighlightPointCallback: function(g, seriesName, ctx, cx, cy, color, radius) {
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.arc(cx, cy, radius, 0, 2 * Math.PI, false);
                    ctx.fill();
                },
                underlayCallback: function(canvasCtx, area, g) {
                    var prevAlpha = canvasCtx.globalAlpha;
                    canvasCtx.globalAlpha = 0.4;

                    /*if (!model.hasData && !model.spinning) {
                        canvasCtx.font = '20px Verdana';
                        canvasCtx.textAlign = 'center';
                        canvasCtx.textBaseline = 'middle';
                        var textX = area.x + (area.w / 2);
                        var textY = area.y + (area.h / 2);
                        canvasCtx.fillText('no data for this range', textX, textY);
                    }*/

                    guidelines.forEach(function(guideline) {
                        if (guideline['y2'] === null)
                            return;

                        var y1, y2;
                        if (guideline['y1'] === -Infinity) {
                            y1 = area.y + area.h;
                        } else {
                            y1 = g.toDomCoords(0, guideline['y1'])[1];
                        }

                        if (guideline['y2'] === Infinity) {
                            y2 = 0;
                        } else {
                            y2 = g.toDomCoords(0, guideline['y2'])[1];
                        }

                        canvasCtx.fillStyle = guideline['color'];
                        canvasCtx.fillRect(
                            area.x, Math.min(y1, y2),
                            area.w, Math.abs(y2 - y1)
                        );
                    });
                    canvasCtx.globalAlpha = prevAlpha;
                }
            });
        }

        /**
         * Returns an array of y-coordinates for indicating OOL ranges
         */
        function calculateGuidelines(pinfo) {
            var guidelines = [];
            if (pinfo.hasOwnProperty('type') && pinfo['type'].hasOwnProperty('defaultAlarm')) {
                var defaultAlarm = pinfo['type']['defaultAlarm'];
                if (defaultAlarm.hasOwnProperty('staticAlarmRange')) {

                    var last_y = -Infinity;
                    var i, range, guideline;

                    // LOW LIMITS
                    for (i = defaultAlarm['staticAlarmRange'].length - 1; i >= 0; i--) {
                        range = defaultAlarm['staticAlarmRange'][i];
                        if (range.hasOwnProperty('minInclusive')) {
                            guideline = {
                                y1: last_y,
                                y2: range['minInclusive'],
                                color: colorForLevel(range['level'])
                            };
                            guidelines.push(guideline);
                            last_y = guideline['y2'];
                        }
                    }

                    // HIGH LIMITS
                    last_y = Infinity;
                    for (i = defaultAlarm['staticAlarmRange'].length - 1; i >= 0; i--) {
                        range = defaultAlarm['staticAlarmRange'][i];
                        if (range.hasOwnProperty('maxInclusive')) {
                            guideline = {
                                y1: range['maxInclusive'],
                                y2: last_y,
                                color: colorForLevel(range['level'])
                            };
                            guidelines.push(guideline);
                            last_y = guideline['y1'];
                        }
                    }
                }
            }
            return guidelines;
        }

        /**
         * Provides an initial y-range based on static alarm ranges. The intent
         * is to make sure the horizontal guidelines always get shown regardless
         * of actual data.
         *
         * Needs to be adjusted when data gets updated in case it exceeds any
         * range.
         */
        function calculateInitialPlotRange(pinfo) {
            var min = null;
            var max = null;
            if (pinfo && pinfo.hasOwnProperty('type') && pinfo['type'].hasOwnProperty('defaultAlarm')) {
                var defaultAlarm = pinfo['type']['defaultAlarm'];
                if (defaultAlarm.hasOwnProperty('staticAlarmRange')) {
                    defaultAlarm['staticAlarmRange'].forEach(function (range) {
                        if (range.hasOwnProperty('minInclusive')) {
                            min = (min === null) ? range['minInclusive'] : Math.min(range['minInclusive'], min);
                            max = (max === null) ? range['minInclusive'] : Math.max(range['minInclusive'], max);
                        }
                        if (range.hasOwnProperty('maxInclusive')) {
                            min = (min === null) ? range['maxInclusive'] : Math.min(range['maxInclusive'], min);
                            max = (max === null) ? range['maxInclusive'] : Math.max(range['maxInclusive'], max);
                        }
                    });
                }
            }

            // Hmm null appears to be interpreted as 0...
            if (min === null) min = max;
            if (max === null) max = min;
            return [min, max];
        }

        function colorForLevel(level) {
            if (level == 'WATCH') return '#ffdddb';
            else if (level == 'WARNING') return '#ffc3c1';
            else if (level == 'DISTRESS') return '#ffaaa8';
            else if (level == 'CRITICAL') return '#c35e5c';
            else if (level == 'SEVERE') return '#a94442';
            else $log.error('Unknown level ' + level);
        }

        function updateGraph(g, model) {
            if (model.splicedPoints.length === 0) {
                g.updateOptions({ file: 'x\n' });
            } else {
                updateValueRange(g, model.valueRange, model.min_y, model.max_y);
                g.updateOptions({
                    file: model.splicedPoints,
                    drawPoints: model.splicedPoints.length < 50
                });

                /*g.setAnnotations([{
                     series: "/YSS/SIMULATOR/BatteryVoltage2",
                     x: Date.parse("2015-11-26T18:50:00"),
                     shortText: "W",
                     text: "Coldest Day"
                }]);*/ // TODO date needs to match exactly an existing point :/ there seems to be a method findClosestRow
            }
        }

        /**
         * Ensures the valueRange contains at least the provided
         * low and high values
         */
        function updateValueRange(g, valueRange, low, high) {
            if ((typeof valueRange[0] !== 'undefined') && (typeof high !== 'undefined')) {
                valueRange[0] = Math.min(valueRange[0], low);
                g.updateOptions({ valueRange: valueRange });
            }
            if ((typeof valueRange[1] !== 'undefined') && (typeof high !== 'undefined')) {
                valueRange[1] = Math.max(valueRange[1], high);
                g.updateOptions({ valueRange: valueRange });
            }
        }
    }

    /**
     * Converts the REST sample data to native dygraphs format
     * http://dygraphs.com/data.html#array
     */
    function convertSampleDataToDygraphs(incomingData) {
        var rangeMin, rangeMax;
        var points = [];
        if (incomingData['sample']) {
            for (var i = 0; i < incomingData['sample'].length; i++) {
                var sample = incomingData['sample'][i];
                var t = new Date();
                t.setTime(Date.parse(sample['time']));
                var v = sample['avg'];
                var min = sample['min'];
                var max = sample['max'];

                if (typeof rangeMin === 'undefined') {
                    rangeMin = min;
                    rangeMax = max;
                } else {
                    if (rangeMin > min) rangeMin = min;
                    if (rangeMax < max) rangeMax = max;
                }
                points.push([t, [min, v, max]]);
            }
        }

        return [{
            //name: qname,
            points: points,
            min: rangeMin,
            max: rangeMax
        }];
    }
})();

(function() {
    'use strict';

    Shell.$inject = ["$rootScope", "$scope", "$location", "socket", "configService"];
    angular
        .module('yamcs.core')
        .config(configureModule)
        .controller('Shell', Shell);

    function configureModule() {
        toastr.options = {
            tapToDismiss: true,
            debug: false,
            positionClass: 'toast-position'
        }
    }

    /* @ngInject */
    function Shell($rootScope, $scope, $location, socket, configService) {
        var vm = this;

        vm.socketOpen = false;
        vm.socketInfoType = 'danger';

        vm.isActive = function (viewLocation) {
            return $location.path().indexOf(viewLocation) === 0;
        };

        vm.appTitle = configService.get('title');
        vm.brandImage = configService.get('brandImage');

        /*
            MESSAGE CENTER
            (currently used only for page-scoped errors)
         */
        vm.messages = [];
        vm.closeMessage = function (idx) {
            vm.messages.splice(idx, 1);
        };
        $rootScope.$on('exception', function(evt, message) {
            vm.messages.push(message);
        });
        $rootScope.$on('$routeChangeStart', function(next, current) {
            vm.messages = [];
        });

        /*
            LIVE CONNECTION
         */
        socket.on('open', function () {
            vm.socketOpen = true;
            vm.socketInfoType = 'success';
        });
        socket.on('close', function () {
            vm.socketOpen = false;
            vm.socketInfoType = 'danger';
        });

        /*
            EVENT STATS
         */
        vm.alarmBadgeColor = '#9d9d9d';
        $rootScope.$on('yamcs.eventStats', function (evt, stats) {
            vm.eventStats = stats;
        });
        if (configService.get('enableNotifications', true)) {
            $rootScope.$on('yamcs.event', function (evt, event) {
                if (event['severity'] === 'ERROR') {
                    toastr.error(event['message']);
                } else if (event['severity'] === 'WARNING') {
                    toastr.warning(event['message']);
                } else {
                    toastr.info(event['message']);
                }
            });
        }

        /*
            ALARM STATS
         */
        vm.alarmCount = 0;
        vm.alarmBadgeColor = '#9d9d9d';

        $rootScope.$on('yamcs.alarmStats', function (evt, stats) {
            vm.alarmStats = stats;
        });

        $rootScope.$on('yamcs.time', function (evt, data) {
            vm.timeData = data;
        });
    }
})();

(function () {
    angular.module('yamcs.core')

    .filter('cut', function () {
        return function (value, wordwise, max, tail) {
            if (!value) return '';

            max = parseInt(max, 10);
            if (!max) return value;
            if (value.length <= max) return value;

            value = value.substr(0, max);
            if (wordwise) {
                var lastspace = value.lastIndexOf(' ');
                if (lastspace != -1) {
                    value = value.substr(0, lastspace);
                }
            }

            return value + (tail || ' …');
        };
    })

    .filter('slice', function () {
        return function (value, start, end) {
            if (!value) return '';
            return value.slice(start, end);
        };
    })

    .filter('capitalize', function () {
        return function (value) {
            if (!value) return '';
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        };
    })

    .filter('nvl', function () {
        return function (value, ifNoValue) {
            if (!value) return ifNoValue;
            return value;
        };
    })

    .filter('stripHTML', function() {
        return function(text) {
            if (!text) return '';
            return String(text).replace(/<[^>]+>/gm, '');
        }
     })

    .filter('startsWith', function() {
        return function(haystack, needle) {
            if (!haystack || !needle) return false;
            return haystack.slice(0, needle.length) === needle;
        }
     })

    .filter('join', function () {
        return function (arr, sep) {
            sep = sep || ' ';
            if (!arr) return '';
            var result = '';
            for (var i = 0; i < arr.length; i++) {
                if (i != 0) result += sep;
                result += arr[i];
            }
            return result;
        };
    })

    .filter('joinBy', function () {
        return function (arr, key, sep) {
            sep = sep || ' ';
            if (!arr) return '';
            var result = '';
            for (var i = 0; i < arr.length; i++) {
                if (i != 0) result += sep;
                result += arr[i][key];
            }
            return result;
        };
    })

    .filter('nl2br', function() {
        return function(data) {
            if (!data) return data;
            return data.replace(/\n\r?/g, '<br />');
        };
    })

/*
.filter('nl2br', ['$sanitize', function($sanitize) {
	return function(msg) {
		// ngSanitize's linky filter changes \r and \n to &#10; and &#13; respectively
		msg = (msg + '').replace(/(\r\n|\n\r|\r|\n|&#10;&#13;|&#13;&#10;|&#10;|&#13;)/g, '<br>$1');
		return $sanitize(msg);
	};
}]);
 */

    /*
        Returns whether an object has a property. This is sometimes more
        useful than the default if-behaviour, because if a property value is 0,
        the if would not resolve.
     */
    .filter('has', function () {
        return function (obj, prop) {
            return obj && obj.hasOwnProperty(prop);
        };
    })

    /*
        Parses a string value to a UTC Moment
     */
    .filter('parseUTC', function() {
        return function(value) {
            if (!value) return value;
            return moment.utc(value);
        };
    })

    /*
        Formats a Moment as UTC or as Local time.
        Currently not using moment-timezone, because of limitations of
        dygraphs. (only local or utc time are supported)
     */
    .filter('formatDate', /* @ngInject */ ["configService", function(configService) {
        return function(value, format, printPrefix) {
            if (!value) return value;
            var ts = value;
            if (!configService.get('utcOnly')) {
                return value.clone().local();
            }

            var prefix;
            if (!format) {
                prefix = (printPrefix) ? 'on ' : '';
                return prefix + ts.format('YYYY-MM-DDTHH:mm:ss');
            } else if (format === 'with_offset') {
                prefix = (printPrefix) ? 'on ' : '';
                return prefix + ts.format();
            } else if (format === 'pretty') {
                prefix = (printPrefix) ? 'on ' : '';
                return prefix + ts.format('MMM Do HH:mm:ss');
            } else if (format === 'pretty_short') {
                var now = moment();
                if (now.isSame(ts, 'd')) {
                    prefix = (printPrefix) ? 'at ' : '';
                    return prefix + ts.format('HH:mm:ss');
                } else {
                    prefix = (printPrefix) ? ' at ' : ' ';
                    return ts.format('MMM Do') + prefix + ts.format('HH:mm:ss');
                }
            } else {
                prefix = (printPrefix) ? 'on ' : '';
                return prefix + ts.format(format);
            }
        };
    }])
})();

(function() {
    'use strict';

    HeaderController.$inject = ["$location", "yamcsInstance"];
    angular
        .module('yamcs.core')
        .controller('HeaderController', HeaderController);

    /* @ngInject */
    function HeaderController($location, yamcsInstance) {
        var vm = this;
        vm.isActive = function (viewLocation) {
            return $location.path().indexOf('/' + yamcsInstance + viewLocation) === 0;
        };
    }
})();

(function() {
    'use strict';

    configService.$inject = ["yamcsInstance", "remoteConfig"];
    angular
        .module('yamcs.core')
        .factory('configService', configService);

    /* @ngInject */
    function configService(yamcsInstance, remoteConfig) {

        var config = remoteConfig;
        config['title'] = remoteConfig['title'] || 'Untitled';
        config['yamcsInstance'] = yamcsInstance;

        if (config.hasOwnProperty('brandImage')) {
            config['brandImage'] = '/_static/' + yamcsInstance + '/' + config['brandImage'];
        }

        return {
            getYamcsInstance: getYamcsInstance,
            get: get
        };

        function getYamcsInstance() {
            return yamcsInstance;
        }

        function get(key, defaultValue) {
            if (config.hasOwnProperty(key)) {
                return config[key];
            } else {
                return defaultValue;
            }
        }
    }
})();

(function () {
    'use strict';

    configureModule.$inject = ["$locationProvider", "$provide"];
    angular
        .module('yamcs', [
            'yamcs.core',
            'yamcs.alarms',
            'yamcs.displays',
            'yamcs.events',
            'yamcs.home',
            'yamcs.intf',
            'yamcs.mdb',
            'yamcs.uss'
        ])
        .config(configureModule);

    /* @ngInject */
    function configureModule($locationProvider, $provide) {
        // Remove hash-tags from the URLs
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });

        // Catch exception messages and store them in root scope to make them available app-wide
        $provide.decorator('$exceptionHandler', /* @ngInject*/ ["$delegate", "$injector", function($delegate, $injector) {
            return function(exception, cause) {
                $delegate(exception, cause);
                var rootScope = $injector.get('$rootScope');
                rootScope.$broadcast('exception', {
                    type: 'danger',
                    msg: exception.message
                });
            };
        }])
    }
})();
