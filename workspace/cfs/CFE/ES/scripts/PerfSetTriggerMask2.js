importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var cmdString = '/CFS/CFE_ES/PerfSetTriggerMask2(';

for(var i = 33; i <= 64; ++i) {
	var PerfID = 'PerfTrigger' + i;
	var RequestTriggerName = 'TriggerRequest' + i;
	cmdString = cmdString + PerfID + ': ' + VTypeHelper.getDouble(display.getWidget(RequestTriggerName).getPropertyValue('pv_value'));
	if(i < 64) {
		cmdString = cmdString + ', ';
	}	
}
cmdString = cmdString + ')';

Yamcs.issueCommand(cmdString);
