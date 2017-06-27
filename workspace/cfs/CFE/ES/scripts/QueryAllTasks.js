importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var fileName = display.getWidget("inFileName").getPropertyValue("text");

Yamcs.issueCommand('/CFS/CFE_ES/QueryAllTasks(FileName: ' + fileName + ')');
