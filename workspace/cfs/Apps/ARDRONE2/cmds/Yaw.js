importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var yaw =VTypeHelper.getDouble(display.getWidget('inYaw').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/Yaw(Yaw: ' + yaw + ')';

Yamcs.issueCommand(cmd);