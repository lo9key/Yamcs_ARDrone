importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var ipAddressDrone = "192.168.1.5"

var cmd = '/CFS/TO/OutputEnable(DestIP: ' + ipAddressDrone + ')';

Yamcs.issueCommand(cmd);

display.getWidget("localHostBtn").setPropertyValue("enabled", false);
display.getWidget("ardroneBtn").setPropertyValue("enabled", false);
display.getWidget("localHostBtn_1").setPropertyValue("enabled", false);


