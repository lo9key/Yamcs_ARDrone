importPackage(Packages.org.csstudio.opibuilder.scriptUtil);
importPackage(Packages.org.yamcs.studio.script);
importPackage(Packages.org.csstudio.simplepv);

var optionTag =VTypeHelper.getString(display.getWidget('inOptionTag').getPropertyValue('pv_value'));
var setFlag =VTypeHelper.getDouble(display.getWidget('inSetFlag').getPropertyValue('pv_value'));
var cmd = '/CFS/ARDRONE2/ModNavOpt(OptionTag: ' + optionTag + ', SetFlag: ' + setFlag + ')';

Yamcs.issueCommand(cmd);
