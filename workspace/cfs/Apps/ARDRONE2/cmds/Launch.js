importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);

Yamcs.issueCommand('/CFS/ARDRONE2/Launch(arg: none)');
display.getWidget("Hover").setPropertyValue("enabled", true);
display.getWidget("Land").setPropertyValue("enabled", true);
display.getWidget("CalMagBtn").setPropertyValue("enabled", true);
display.getWidget("SetFltTrimBtn").setPropertyValue("enabled", false);
display.getWidget("Launch").setPropertyValue("enabled", false);