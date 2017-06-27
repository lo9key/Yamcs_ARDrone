importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var pitch =VTypeHelper.getDouble(display.getWidget('inPitch').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/Pitch(Pitch: ' + pitch + ')';

Yamcs.issueCommand(cmd);