importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var ipAddress =VTypeHelper.getString(display.getWidget('inHostIPAddress').getPropertyValue('pv_value'));

var cmd = '/CFS/TO/OutputEnable(DestIP: ' + ipAddress + ')';

Yamcs.issueCommand(cmd);

display.getWidget("localHostBtn").setPropertyValue("enabled", false);
display.getWidget("ardroneBtn").setPropertyValue("enabled", false);
display.getWidget("localHostBtn_1").setPropertyValue("enabled", false);
