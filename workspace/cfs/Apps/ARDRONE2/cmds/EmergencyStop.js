importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);

Yamcs.issueCommand('/CFS/ARDRONE2/EmergencyStop(arg: none)');

display.getWidget("Launch").setPropertyValue("enabled", false);
display.getWidget("Hover").setPropertyValue("enabled", false);
display.getWidget("CalMagBtn").setPropertyValue("enabled", false);
display.getWidget("SetFltTrimBtn").setPropertyValue("enabled", true);
display.getWidget("Land").setPropertyValue("enabled", false);

/*
display.getWidget("SendRollBtn").setPropertyValue("enabled", false);
display.getWidget("SendPitchBtn").setPropertyValue("enabled", false);
display.getWidget("SendYawBtn").setPropertyValue("enabled", false);
display.getWidget("SendVerticalBtn").setPropertyValue("enabled", false);
display.getWidget("SetLed").setPropertyValue("enabled", false);
*/
display.getWidget("SetMoveAnim").setPropertyValue("enabled", false);