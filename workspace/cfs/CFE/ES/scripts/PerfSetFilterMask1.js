importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var cmdString = '/CFS/CFE_ES/PerfSetFilterMask1(';

for(var i = 1; i <= 32; ++i) {
	var PerfID = 'PerfFilter' + i;
	var RequestFilterName = 'FilterRequest' + i;
	cmdString = cmdString + PerfID + ': ' + VTypeHelper.getDouble(display.getWidget(RequestFilterName).getPropertyValue('pv_value'));
	if(i < 32) {
		cmdString = cmdString + ', ';
	}	
}
cmdString = cmdString + ')';

Yamcs.issueCommand(cmdString);