importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var animSeq =VTypeHelper.getString(display.getWidget('inAnimSeq').getPropertyValue('pv_value'));
var duration =VTypeHelper.getDouble(display.getWidget('inDuration').getPropertyValue('pv_value'));
var frequency =VTypeHelper.getDouble(display.getWidget('inFrequency').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/LedAnim(AnimSeq: ' + animSeq + ', Duration: ' + duration + ', Frequency: ' + frequency + ')';

Yamcs.issueCommand(cmd);
