importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var moveSeq = VTypeHelper.getString(display.getWidget('inMoveSeq').getPropertyValue('pv_value'));
var duration = VTypeHelper.getDouble(display.getWidget('inMoveDuration').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/MoveAnim(MoveSeq: ' + moveSeq + ', MoveDuration: ' + duration + ')';

Yamcs.issueCommand(cmd);
