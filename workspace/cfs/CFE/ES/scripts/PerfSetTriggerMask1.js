importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var cmdString = '/CFS/CFE_ES/PerfSetTriggerMask1(';

for(var i = 1; i <= 32; ++i) {
	var PerfID = 'PerfTrigger' + i;
	var RequestTriggerName = 'TriggerRequest' + i;
	cmdString = cmdString + PerfID + ': ' + VTypeHelper.getDouble(display.getWidget(RequestTriggerName).getPropertyValue('pv_value'));
	if(i < 32) {
		cmdString = cmdString + ', ';
	}	
}
cmdString = cmdString + ')';

Yamcs.issueCommand(cmdString);
