importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var roll =VTypeHelper.getDouble(display.getWidget('inRoll').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/Roll(Roll: ' + roll + ')';

Yamcs.issueCommand(cmd);