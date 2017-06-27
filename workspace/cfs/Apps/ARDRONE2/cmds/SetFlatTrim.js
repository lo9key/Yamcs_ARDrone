importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);

Yamcs.issueCommand('/CFS/ARDRONE2/SetFlatTrim(arg: none)');

display.getWidget("Launch").setPropertyValue("enabled", true);
