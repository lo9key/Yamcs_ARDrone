importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var ipAddressLocalHost = "127.0.0.1"

var cmd = '/CFS/TO/OutputEnable(DestIP: ' + ipAddressLocalHost + ')';

Yamcs.issueCommand(cmd);

display.getWidget("localHostBtn").setPropertyValue("enabled", false);
display.getWidget("ardroneBtn").setPropertyValue("enabled", false);
display.getWidget("localHostBtn_1").setPropertyValue("enabled", false);
