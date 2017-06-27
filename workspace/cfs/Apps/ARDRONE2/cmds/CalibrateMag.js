importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);

Yamcs.issueCommand('/CFS/ARDRONE2/CalMag(arg: none)');

display.getWidget("SendRollBtn").setPropertyValue("enabled", true);
display.getWidget("SendPitchBtn").setPropertyValue("enabled", true);
display.getWidget("SendYawBtn").setPropertyValue("enabled", true);
display.getWidget("SendVerticalBtn").setPropertyValue("enabled", true);
display.getWidget("SetMoveAnim").setPropertyValue("enabled", true);