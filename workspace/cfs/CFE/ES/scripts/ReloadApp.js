importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var appName =VTypeHelper.getString(display.getWidget('inAppName').getPropertyValue('pv_value'));
var fileName = display.getWidget("inFileName").getPropertyValue("text");

Yamcs.issueCommand('/CFS/CFE_ES/ReloadApp(Name: ' + appName + ', FileName: ' + fileName + ')');
