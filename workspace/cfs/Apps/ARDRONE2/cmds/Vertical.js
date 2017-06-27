importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var vertical =VTypeHelper.getDouble(display.getWidget('inVertical').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/Vertical(Vertical: ' + vertical + ')';

Yamcs.issueCommand(cmd);