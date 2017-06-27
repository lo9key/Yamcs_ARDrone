importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var cmdString = '/CFS/CFE_ES/PerfSetFilterMask2(';

for(var i = 33; i <= 64; ++i) {
	var PerfID = 'PerfFilter' + i;
	var RequestFilterName = 'FilterRequest' + i;
	cmdString = cmdString + PerfID + ': ' + VTypeHelper.getDouble(display.getWidget(RequestFilterName).getPropertyValue('pv_value'));
	if(i < 64) {
		cmdString = cmdString + ', ';
	}	
}
cmdString = cmdString + ')';

Yamcs.issueCommand(cmdString);