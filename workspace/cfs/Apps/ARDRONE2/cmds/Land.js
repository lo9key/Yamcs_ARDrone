importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);

Yamcs.issueCommand('/CFS/ARDRONE2/Land(arg: none)');
display.getWidget("Launch").setPropertyValue("enabled", false);
display.getWidget("Hover").setPropertyValue("enabled", false);
display.getWidget("CalMagBtn").setPropertyValue("enabled", false);
display.getWidget("SetFltTrimBtn").setPropertyValue("enabled", true);
display.getWidget("Land").setPropertyValue("enabled", false);