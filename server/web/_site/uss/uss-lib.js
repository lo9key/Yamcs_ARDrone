//this file contains some "static" loading, parsing and other util functions

var USS = {
   computationCount:0,
   widgetCount: 0,
   
   opsNamespace: 'MDB:OPS Name',
   //dynamic properties
   dp_VALUE: 'VALUE',
   dp_X: 'X',
   dp_Y: 'Y',
   dp_FILL_COLOR: 'FILL_COLOR'
}; //USS namespace

USS.parseDataBinding = function(e) {
    var db=new Object();
    db.dynamicProperty=$(e).children('DynamicProperty').text();
    var ds=$(e).children('DataSource')[0];
    if(ds.hasAttribute('reference')) {
        ds=USS.getReferencedElement(ds);
    }
    db.type=ds.getAttribute('class');
    if(db.type=='ExternalDataSource') {
        $('Names entry', ds).each(function(idx, val) {
            var n=$('string:nth-child(1)', val).text(); //one of 'Opsname', 'Pathname' or 'SID'
            db[n]=$('string:nth-child(2)', val).text();
        });
        if(db.Opsname!==undefined) {
            db.parameterName=db.Opsname.trim();
            db.parameterNamespace = USS.opsNamespace.trim();
         } else {
            console.log("External Data source without Opsname", ds);
         }
         db.usingRaw=($(ds).children('UsingRaw').text().toLowerCase()==='true');
    } else if (db.type=='Computation') {
       var pname="__uss_computation"+USS.computationCount;
       USS.computationCount++;
       var c=new Object();
       c.expression=$(ds).children('Expression').text();
       c.args=[];
       c.parameterName=pname;

       $('Arguments ExternalDataSource', e).each(function(idx, val) {
            var arg=new Object();
            $('Names entry', val).each(function(idx, val1) {
                var n=$('string:nth-child(1)', val1).text(); //one of 'Opsname', 'Pathname' or 'SID'
                arg[n]=$('string:nth-child(2)', val1).text();
            });
            c.args.push(arg);
        });
       var names=$(ds).children('Names');
       $('entry', names).each(function(idx, val) {
            var n=$('string:nth-child(1)', val).text(); //DEFAULT
            db[n]=$('string:nth-child(2)', val).text();
        });
       db.expression=c.expression;
       db.args=c.args;
       db.parameterName=pname;
    }
    return db;
};

/*
/*
* Writes text in the bounding box opts:x,y,width,height
* TODO: only works for left to right horizontal text
*/
USS.writeText = function(svg, parent, opts, textStyle, text) {
    var settings={id: opts.id};
    $.extend(settings, USS.parseTextStyle(textStyle));
    var horizAlignment=$(textStyle).children('HorizontalAlignment').text().toLowerCase();
    var vertAlignment=$(textStyle).children('VerticalAlignment').text().toLowerCase();
    var x;
    if(horizAlignment == "center") {
        x=opts.x+opts.width/2;
        settings.textAnchor='middle';
    } else if(horizAlignment == "left") {
        x=opts.x;
        settings.textAnchor='start';
    } else if(horizAlignment == "right") {
        x=opts.x+opts.width;
        settings.textAnchor='end';
    }

    text = text.split(" ").join("\u00a0"); // Preserve whitespace
    var t=svg.text(parent, x, opts.y, text, settings);
    var bbox=t.getBBox();
    //shift to have the bbox correspond to x,y,width,height
    if(vertAlignment == "center") {
        t.setAttribute('dy', opts.y - bbox.y + (opts.height - bbox.height)/2);
    } else if(vertAlignment == "top") {
        t.setAttribute('dy', opts.y-bbox.y);
    } else if(vertAlignment == "bottom") {
        t.setAttribute('dy', opts.y - bbox.y + opts.height - bbox.height);
    }
    return t;
};

USS.parseFillStyle = function(e) {
    var fs=new Object();
    var obj=$(e).children('FillStyle');
    fs.fill=USS.parseColor($(obj).children('Color')[0]);
    var pattern=$(obj).children('Pattern').text().toLowerCase();
    if(pattern === 'solid') {
        fs.fillOpacity=1;
    } else {
        fs.fillOpacity=0;
    }
   return fs
};

USS.parseDrawStyle = function(e) {
    var ds=new Object();
    var obj=$(e).children('DrawStyle');
    var pattern=$(obj).children('Pattern').text().toLowerCase();
    if(pattern === 'solid') {
        ds.strokeOpacity=1;
    } else {
        ds.strokeOpacity=0;
    }
    ds.stroke=USS.parseColor($(obj).children('Color'));
    ds.strokeWidth=$(obj).children('Width').text();
    return ds;
};

USS.parseTextStyle=function(e) {
    var ts=new Object();
    ts.fontSize=$(e).children('Fontsize').text()+'px';
    ts.fontFamily=$(e).children('Fontname').text();
    if(ts.fontFamily=='Lucida Sans Typewriter') {
       ts.fontFamily='Lucida Sans Typewriter, monospace';
    }
    var bold= ($("IsBold:first", e).text().toLowerCase() === 'true');
    if(bold)  ts.fontWeight="bold";
    var italic= ($("IsItalic:first", e).text().toLowerCase() === 'true');
    if(italic)  ts.fontStyle="italic";
    var underline= ($("IsUnderlined:first", e).text().toLowerCase() === 'true');
    if(underline) ts.textDecoration="underline";
    ts.fill=USS.parseColor($(e).children('Color')[0]);
    return ts;
};


USS.parseColor =function(e, defaultColor) {
    if(!e) return defaultColor;
    var $e = $(e);
    var red=$e.children('red').text();
    var green=$e.children('green').text();
    var blue=$e.children('blue').text();
    var alpha=$e.children('alpha').text();
    return "rgba("+red+","+green+","+blue+","+alpha+")";
};

USS.getReferencedElement = function(e) {
    var tokens=e.getAttribute('reference').split('/');
    
    for (var i in tokens) {
        var token=tokens[i];
        if (token == "..") {
            e = e.parentNode;
        } else {
            var idx = 0;
            var k = token.indexOf('[');
            var nodeName=token;
            if (k != -1) {
                var idxStr = token.substring(k + 1, token.indexOf(']', k));
                idx = parseInt(idxStr)-1;
                nodeName = token.substring(0, k);
            }
            e=$(e).children(nodeName)[idx];
        }
    }
   return e; 
};

//creates a definition section in the SVG and adds the markers that will be used for polylines arrows
// TODO: It is broken currently because the markers will show all in black, instead of the color of the line
USS.addArrowMarkers = function(svg) {
        var defs = svg.defs();

        var settings = {overflow: 'visible', fill:'currentColor', stroke: 'none'};
        var arrowMarkerStart = svg.marker(defs, 'uss-arrowStart', 0, 0, 20, 20, 'auto', settings);

        var path = svg.createPath();
        svg.path(arrowMarkerStart, path.move(0, -15).line(-20, 0).line(0, 15),
            {fillRule: 'evenodd', fillOpacity: '1.0', transform: 'scale(0.2, 0.2) translate(20, 0)'});

        var arrowMarkerEnd = svg.marker(defs, 'uss-arrowEnd', 0, 0, 20, 20, 'auto', settings);

        path = path.reset();
        svg.path(arrowMarkerEnd, path.move(0, -15).line(-20, 0).line(0, 15),
            {fillRule: 'evenodd', fillOpacity: '1.0', transform: 'scale(0.2, 0.2) rotate(180) translate(20, 0)'});
};

USS.engValueToString = function(engValue, decimals) {
   switch(engValue.type) {
       case 0:
         return engValue.floatValue.toFixed(decimals);
       case 1:
         return engValue.doubleValue.toFixed(decimals);
    }
   for(var idx in engValue) {
      if(idx!='type') return engValue[idx];
   }
};

USS.getParameterValue = function(param, usingRaw) {
    if(usingRaw) {
        var rv=param.rawValue;
        for(var idx in rv) {
            if(idx!='type') return rv[idx];
        }
    } else {
        var ev=param.engValue;
        if(ev === undefined) {
            console.log('got parameter without engValue: ', param);
            return null;
        }
        switch(ev.type) {
            case 'FLOAT':
                return ev.floatValue;
            case 'DOUBLE':
                return ev.doubleValue;
            case 'BINARY':
                return window.atob(ev.binaryValue);
        }
        for(var idx in ev) {
            if(idx!='type') return ev[idx];
        }
    }
};

//used from the NavigationButton
USS.openDisplay = function(displayBaseName) {
    if(typeof(showDisplay) === 'function') {
        showDisplay(displayBaseName+".uss");
    } else {
        alert("This button only works when the display is running inside the full USS app");
    }
};


//get the parameter id for the parameter shown in the widget for plotting or info
USS.getParameterFromWidget = function(widget) {
   for(var i in widget.dataBindings) {
       var p = widget.dataBindings[i];
       if(p.dynamicProperty==USS.dp_VALUE) {
	    return {name: p.parameterName, namespace: p.parameterNamespace}
       }
   }
};

/*contains the following objects
* Display
* and basic widgets
*    Label
*    Field
*    Polyline
*    Rectangle
*    Symbol
*    ExternalImage
*    NavigationButton
*************/

(function () {


USS.Display = function(div) {
    this.widgets = {};
    this.parameters = {};
    this.div = div;
    this.bgcolor = '#D4D4D4';
};


USS.Display.prototype = {
    constructor: USS.Display,
    parseAndDraw: function (xmlDoc) {
        var display=$("Display:first", xmlDoc);
        var width = this.width = parseInt(display.children('Width').text());
        var height = this.height = parseInt(display.children('Height').text());
 
        var svg = this.svg = $(this.div).svg('get');

        svg.configure({
            height: height,
            width: width,
            class: 'canvas',
            'xmlns': 'http://www.w3.org/2000/svg',
            'xmlns:xlink': 'http://www.w3.org/1999/xlink'
        });
        
        USS.addArrowMarkers(svg);
        
        //draw background
        this.bgcolor=USS.parseColor($(display).children("BackgroundColor")[0], '#D4D4D4');
        
        svg.rect(0, 0, width, height, {fill: this.bgcolor});
        this.drawElements(svg, null, display.children("Elements").children());
    },
        

    drawElements: function(svg, parent, elements) {
        //sort element such that they are drawn in order of their Depth
        // TODO: those that have the same Depth have to still be sorted according to some TBD behaviour
        elements=Array.prototype.slice.call(elements,0);
        for(var i=0;i<elements.length;i++) {
            var e=elements[i];
            e.widgetType=e.nodeName;
            if(e.hasAttribute('reference')) {
                elements[i] = USS.getReferencedElement(e);
                elements[i].widgetType = e.widgetType;
            }
        }
        elements.sort(function(a,b) {
            var da=parseInt($(a).children('Depth').text());
            var db=parseInt($(b).children('Depth').text());
            var bname=$(b).children('Name').text();
            return da-db;
        });
        for(var i=0;i<elements.length;i++) {
            this.drawWidget(svg, parent, elements[i]);
        }
    },

    drawWidget: function(svg, parent, e) {
        var opts=this.parseStandardOptions(e);
        var widgetType=e.widgetType;
         
        if(widgetType=="Compound") { 
            //this corresponds to the group feature of USS. We make a SVG group.
            var g=svg.group(parent, opts.id);
            this.drawElements(svg, g, $(e).children('Elements').children());
        } else if(typeof (USS[widgetType]) === 'function') {
            var w = new USS[widgetType]();
            //make the standard properties part of the object
            w.id = "w" + USS.widgetCount;
            USS.widgetCount+=1;
            w.x = opts.x; w.y = opts.y; 
            w.width = opts.width; w.height = opts.height;
            w.dataBindings = opts.dataBindings;
            w.svg = svg;

            w.parseAndDraw(svg, parent, e);
            var len=opts.dataBindings.length;

            if(len>0) { 
                this.widgets[w.id]=w; //we only remember those widgets that have dynamic properties
                for(var i=0; i<len; i++) {
                    var db = opts.dataBindings[i];
                    var para = this.parameters[db.parameterName];
                    if (para === undefined) {
                        para = {name: db.parameterName, namespace:db.parameterNamespace, type: db.type, bindings:[]};
                        if(para.type == 'Computation') {
                           para.expression = db.expression;
                           para.args=db.args;
                        }
                        this.parameters[db.parameterName] = para;
                    }
                    var binding = {
                        dynamicProperty: db.dynamicProperty,
                        widget: w,
                        updateWidget: function(para) {
                            console.log('heh2');

                            switch (this.dynamicProperty) {
                                case USS.dp_VALUE:
                                    if (this.widget.updateValue === undefined) {
                                        //console.log('no updateValue for ', widget);
                                        return;
                                    }
                                    this.widget.updateValue(para, this.usingRaw);
                                    break;
                                case USS.dp_X:
                                    this.widget.updatePosition(para, 'x', this.usingRaw);
                                    break;
                                case USS.dp_Y:
                                    this.widget.updatePosition(para, 'y', this.usingRaw);
                                    break;
                                case USS.dp_FILL_COLOR:
                                    this.widget.updateFillColor(para, this.usingRaw);
                                    break;
                                default:
                                    console.log('TODO update dynamic property: ', this.dynamicProperty);
                            }
                        }
                    };

                    if(db.usingRaw !== undefined) {
                        binding.usingRaw=db.usingRaw;
                    }

                    para.bindings.push(binding);
                }
           }
        } else {
            console.log("TODO: widgetType: "+widgetType);
        }
    },
    parseStandardOptions: function(e) {
        var opts = {};
        opts.x=parseInt($(e).children('X').text());
        opts.y=parseInt($(e).children('Y').text());
        opts.width=parseInt($(e).children('Width').text());
        opts.height=parseInt($(e).children('Height').text());
        opts.id=$(e).children('Name').text();

        opts.dataBindings=[];
        $(e).children('DataBindings').children('DataBinding').each(function(idx,val) {
            var db=USS.parseDataBinding(val);
            opts.dataBindings.push(db);
        });
        return opts;
    },
    getParameters: function() {
        var paraList=[];
        for(var paraname in this.parameters) {
            var p=this.parameters[paraname];
            if (p.type=='ExternalDataSource') {
                paraList.push({name: p.name, namespace: p.namespace});
            }
        }
        return paraList;
    },
    updateBindings: function (pvals) {
        for(var i = 0; i < pvals.length; i++) {
            var p = pvals[i];
            var dbs = this.parameters[p.id.name];
            if (dbs && dbs.bindings) {
                for (var j = 0; j < dbs.bindings.length; j++) {
                    dbs.bindings[j].updateWidget(p);
                }
            }
        }
    },
    getComputations: function() {
        var compDefList=[];
        for(var paraname in this.parameters) {
            var p=this.parameters[paraname];
            if (p.type=='Computation') {
                var cdef={name: paraname, expression: p.expression, argument: [], language: 'jformula'};
                var args=p.args;
                for(var i=0;i<args.length;i++) {
                    var a=args[i];
                    cdef.argument.push({name: a.Opsname, namespace: 'MDB:OPS Name'});
                }
                compDefList.push(cdef);
            }
        }
        return compDefList;
    }
};

//basic widget, all the other ones are inheriting from this
USS.AbstractWidget = function() {};
USS.AbstractWidget.prototype = {
     updateValue: function(svg, para, usingRaw) {
         console.log("updateValue called on AbstractWidget. this:", this);
     },
     updatePosition: function(para, attribute, usingRaw) { //attribute is x or y
         var e=this.svg.getElementById(this.id);
         var newpos=USS.getParameterValue(para, usingRaw);
         e.setAttribute(attribute, newpos);
     },
     updatePositionByTranslation: function(svgid, para, attribute, usingRaw) { //attribute is x or y
         var e=this.svg.getElementById(svgid);
         var newpos=USS.getParameterValue(para, usingRaw);
         this[attribute]=newpos;
         e.setAttribute('transform', 'translate('+this.x+','+this.y+')');
     },
     updateFillColor: function(para, usingRaw) {
         var e=this.svg.getElementById(this.id);
         var newcolor=USS.getParameterValue(para, usingRaw);
         this.svg.configure(e, {stroke: newcolor});
     }
     
};

USS.Display.createWidgetTypes = function(widgetTypes) {
    //create empty constructors and prototypes derived from AbstractWidget
    for(var i=0; i<widgetTypes.length; i++) {
        var wt=widgetTypes[i];
        USS[wt] = function () {};
        USS[wt].prototype = new USS.AbstractWidget();
        USS[wt].prototype.constructor = USS[wt];
    }

    /************ Label **********/
    $.extend(USS.Label.prototype, {
        constructor: USS.Label,
        parseAndDraw: function (svg, parent, e) {
            var text=$("Text:first", e).text();
            var textStyle=$(e).children('TextStyle');
            USS.writeText(svg, parent, this, textStyle, text);
        }
    });
};

var widgetTypes=['Label', 'Field', 'Polyline', 'Rectangle', 'Symbol', 'ExternalImage', 'NavigationButton'];
USS.Display.createWidgetTypes(widgetTypes);


/************ Field **********/
$.extend(USS.Field.prototype, {
    decimals: 0,
    parseAndDraw: function(svg, parent, e) {
        //make a group to put the text and the bounding box together
        var settings = {
            transform: "translate("+this.x+","+this.y+")",
            class: "context-menu-field"
        };

        parent = svg.group(parent, this.id+'-group', settings);
        parent.ussWidget = this;

        var $e = $(e);
        var unit=$e.children('Unit').text();
        var decimals=$e.children('Decimals').text();
        if(decimals) {
            this.decimals=parseInt(decimals);
        }
        this.format=$e.children('Format').text();

        var odqi=$e.children('OverrideDQI');
        this.overrideDqi = odqi && (odqi.text().toLowerCase() === 'true');

        var showUnit=$e.children('ShowUnit').text().toLowerCase()==='true';
        var unitWidth=0;
        if(unit && showUnit) {
            var unitTextStyle=USS.parseTextStyle($(e).children('UnitTextStyle'));
            var ut=svg.text(parent, 0, 0, unit, unitTextStyle);

            var bbox=ut.getBBox();
            ut.setAttribute('dx', this.width - bbox.width);

            var unitVertAlignment=$e.children('UnitTextStyle').children('VerticalAlignment').text().toLowerCase();
            if(unitVertAlignment=='center') {
                ut.setAttribute('dy',  -bbox.y + (this.height - bbox.height)/2);
            } else if (unitVertAlignment=='top') {
                ut.setAttribute('dy',  -bbox.y);
            } else if (unitVertAlignment=='bottom') {
                ut.setAttribute('dy', -bbox.y+ (this.height - bbox.height));
            }
            unitWidth=bbox.width+2;
        }
        this.width-=unitWidth;
        var settings = {id: this.id+"-background"}; 
        if(!this.overrideDqi) {
             settings.class='dead-background';
        }

        var id = USS.getParameterFromWidget(this);
        var yamcsInstance = location.pathname.match(/\/([^\/]*)\/?/)[1];
        var rectLink = svg.link(parent, '/' + yamcsInstance + '/mdb/' + id.namespace + '/' + id.name, {});
        svg.rect(rectLink, 0, 0, this.width, this.height, settings);

        USS.writeText(svg, parent, {id: this.id, x: 0, y: 0, width: this.width, height: this.height}, $e.children('TextStyle'), " ");


    },
    updateValue: function(para) {
        var v = USS.getParameterValue(para, this.usingRaw);
        if(typeof v == 'number') {
            if(this.format) {
                v = sprintf(this.format, v);
            } else {
                v=v.toFixed(this.decimals);
            }
        }
        var svg = this.svg;
        var ftxt=svg.getElementById(this.id);
        if (!ftxt)
            return; // TODO temp until we unregister bindings upon window close
        ftxt.textContent = v;
        var dqi=this.getDqi(para);
        svg.configure(ftxt, {class: dqi + "-foreground"});
        if(!this.overrideDqi) {
            var fbg = svg.getElementById(this.id + "-background");
            svg.configure(fbg, {class: dqi+"-background"});
        }
    }, 
    updatePosition: function(para, attribute, usingRaw) {
        this.updatePositionByTranslation(this.id+"-group", para, attribute, usingRaw);
    },
    updateFillColor: function(para, usingRaw) {
        if(!this.overrideDqi) return;
        var newcolor=USS.getParameterValue(para, usingRaw);
        var svg = this.svg;
        var fbg = svg.getElementById(this.id + "-background");
        svg.configure(fbg, {fill: newcolor});
    },
    //the values are CSS classes defined in uss.dqi.css
    alldqi: ['dead', 'disabled', 'in_limits', 'nominal_limit_violation', 'danger_limit_violation', 'static', 'undefined'],
    //implements based on the mcs_dqistyle.xml
    getDqi: function (para) {
        switch(para.acquisitionStatus) {
            case 'ACQUIRED':
                switch(para.monitoringResult) {
                    case 'DISABLED':
                         return 'disabled';
                    case 'IN_LIMITS':
                         return 'in_limits';
                    case 'WATCH':
                    case 'WARNING':
                    case 'DISTRESS':
                         return 'nominal_limit_violation';
                    case 'CRITICAL':
                    case 'SEVERE':
                         return 'danger_limit_violation';
                    case undefined:
                         return 'undefined';
                }
                break;
            case 'NOT_RECEIVED': return 'dead';
            case 'INVALID': return 'dead';
            case 'EXPIRED': return 'expired';
        }
    }
});

/************* Polyline *****************/
$.extend(USS.Polyline.prototype, {
    parseAndDraw: function(svg, parent, e) {
        var points=[];
        $('Point', e).each(function(idx,val) {
            var px=$('x',val).text();
            var py=$('y',val).text();
            points.push([px,py]);
            });
        var settings={fill: "none"};
        var arrowStart=$(e).children('ArrowStart').text().toLowerCase()==='true';
        var arrowEnd=$(e).children('ArrowEnd').text().toLowerCase()==='true';
        if(arrowStart) {
            settings.markerStart="url(#uss-arrowStart)";
        }
        if(arrowEnd) {
            settings.markerEnd="url(#uss-arrowEnd)";
        }
        $.extend(settings, USS.parseDrawStyle(e));

        svg.polyline(parent, points, settings);
     }
});


/************* Rectangle *****************/
USS.Rectangle.prototype.parseAndDraw = function(svg, parent, e) {
    var settings=USS.parseFillStyle(e);
    $.extend(settings, USS.parseDrawStyle(e));
    if((settings.strokeWidth & 1) == 1) {
       this.x+=0.5;
       this.y+=0.5;
    }
    //console.log("Drawing rectangle with settings: ", settings);
    svg.rect(parent, this.x, this.y, this.width, this.height, settings);
};

/************* Symbol *****************/
$.extend(USS.Symbol.prototype, {
    symbolLibrary: {},
    parseAndDraw: function(svg, parent, e) {
        //svg.image(parent, opts.x, opts.y, opts.width, opts.height, "U19_led_3D_grey.svg");
        var libraryName=$(e).children('LibraryName').text();
        var symbolName=$(e).children('SymbolName').text();

        var settings={id: this.id, class: 'uss-symbol'};
        var img=svg.image(parent, this.x, this.y, this.width, this.height, "", settings);
        this.libraryName=libraryName;
        this.symbolName=symbolName;

        var sl=this.symbolLibrary[libraryName];
        if(sl === undefined) {
            this.loadSymbolLibrary(libraryName);
        } 
        //TODO this should be async after the library has been loaded
        sl=this.symbolLibrary[libraryName];
        if (sl && sl.loaded) {
            var s = sl[symbolName];
            if(s === undefined) {
                console.log('Cannot find symbol '+symbolName+' in library '+libraryName);
            } else {
                this.symbol=s;
                img.setAttribute('href', "/_static/symlib/images/"+s.defaultImage);
            }
        }
    },
    loadSymbolLibrary: function(libraryName) {
        //console.log("loading symbol library ", libraryName);
        var sl = {};
        sl.loaded=false;
        this.symbolLibrary[libraryName]=sl;
        $.ajax({
            url: "/_static/symlib/"+libraryName+".xml",
            async: false
        }).done(function(xmlData) {
            $('library symbol', xmlData).each(function(idx, val) {
                var s=new Object();
                s.type=$(val).children('type').text();
                s.name=$(val).children('name').text();
                s.states = {};
                $('image', val).each(function(idx,val1) {
                    var state=val1.getAttribute('state');
                    var img=$(val1).text();
                    if(state) {
                        s.states[state]=img;
                    }
                    if(s.type=='dynamic') {
                        var def=val1.getAttribute('default').toLowerCase()=='true';
                        if(def) {
                            s.defaultImage=img;
                        }
                    } else {
                         s.defaultImage=img;
                    }
                });
                sl[s.name]=s;
            });
            sl.loaded=true;
         });
     },
     updateValue: function(para, usingRaw) {
        var value=USS.getParameterValue(para, usingRaw);
        var img=this.symbol.states[value];
        if(img === undefined) {
            img = symbol.defaultImage;
         }
        var svgimg=this.svg.getElementById(this.id);
        if(svgimg) svgimg.setAttribute('href', "/_static/symlib/images/"+img);
         
     }
});

/************* ExternalImage *****************/
$.extend(USS.ExternalImage.prototype, {
    parseAndDraw: function(svg, parent, e) {
        var pathname=$(e).children('Pathname').text();
        svg.image(parent, this.x, this.y, this.width, this.height, "/_static/"+pathname);
    }
});


/************* NavigationButton *****************/
$.extend(USS.NavigationButton.prototype, {
    
    parseAndDraw: function(svg, parent, e) {
        var $e = $(e);
        var pressCmd = $e.children("PressCommand")[0];
        var cmdClass = pressCmd.getAttribute("class");
        var cmd;
        if(cmdClass == "OpenDisplayCommand") {
            var displayBaseName = $(pressCmd).children("DisplayBasename").text();
            cmd = "USS.openDisplay('"+displayBaseName+"')";
        } else if(cmdClass == "CloseDisplayCommand") {            
            cmd = "USS.closeDisplay()";
        } else {
            console.log("Unsupported command class "+cmdClass);
            return;
        }
        
        
        var settings=USS.parseFillStyle(e);
        $.extend(settings, {
            strokeOpacity: 1,
            stroke: "rgba(0,0,0,255)",
            strokeWidth: "1.0"
        });
        if((settings.strokeWidth & 1) == 1) {
            this.x+=0.5;
            this.y+=0.5;
        }
        parent = svg.group(parent, this.id+'-group', {cursor: "pointer", onmouseup: cmd});        
        svg.rect(parent, this.x, this.y, this.width, this.height, settings);
        var $label = $e.children("ReleasedCompound").children("Elements").children("Label");
        var textStyle = $label.children('TextStyle');
        var text = $label.children('Text').text();
        USS.writeText(svg, parent, this, textStyle, text);        
    }
});

}());

USS.Display.createWidgetTypes(['LineGraph']);
$.extend(USS.LineGraph.prototype, {
    parseAndDraw: function (svg, parent, e) {
        svg.group(parent, this.id, {transform: "translate("+this.x+","+this.y+")"});
        var $e=$(e);
        var type=$e.children('Type').text();
        var title =$e.children('Title').text();
        var labelsStyle= {style: {fontFamily: 'sans-serif', fontSize: '10px'}};

        var titleStyle=USS.parseTextStyle($e.children('TitleTextStyle'));

        var settings={
             chart: { renderTo: this.id, type: 'line', width: this.width, height:this.height,
                      animation: false, clientZoom: false,  spacingTop: 0, spacingBottom: 5},
             legend: {enabled: false},
             credits: {enabled: false},
             title: { text: title, style: titleStyle },
             plotOptions: {
                 line: {
                     color:'black', 
                     animation: false, 
                     shadow:false, 
                     marker: {enabled: false},
                     enableMouseTracking: false
                 }, 
                 series:{lineWidth:1}
             }
       };
       settings.xAxis=this.parseDomainAxis($e.children('DefaultDomainAxis'));
       settings.yAxis=this.parseRangeAxis($e.children('DefaultRangeAxis'));
       settings.series= [{
                id: 'series-1',
                name: this.dataBindings[0].parameterName,
                data: []
              } ];
      this.chart = new Highcharts.Chart(settings);
    },

    parseRangeAxis: function(e) {
        var $e = $(e);
        var titleStyle = {fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 'normal'};
        var labelStyle = {fontFamily: 'sans-serif', fontSize: '10px', fontWeight: 'normal'};

        labelStyle.color = titleStyle.color = USS.parseColor($e.children('AxisColor')[0], 'black');
        var yaxis = {lineWidth:1, lineColor:labelStyle.color, gridLineDashStyle: 'dash', 
                     labels: {style: labelStyle}, startOnTick: false, 
                     tickPixelInterval:20, endOnTick: false};

        var label = $e.children('Label').text();
        yaxis.title = {text: label, style: titleStyle};

        var autoRange = ($e.children('AutoRange').text().toLowerCase()=='true');
        this.yAutoRange = autoRange;
        if(!autoRange) {
            var axisRange=$e.children('AxisRange')[0];
            var min = $(axisRange).children('Lower').text();
            if(min) yaxis.min=parseFloat(min);
            var max = $(axisRange).children('Upper').text();
            if(max) yaxis.max=parseFloat(max);
        }
        var stickyZero = ($e.children('StickyZero').text().toLowerCase()=='true');
        if(stickyZero) yaxis.min=0;
        return yaxis;
    },

    parseDomainAxis: function(e) {
        var titleStyle = {fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 'normal'};
        var labelStyle = {fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 'normal'};
        var $e=$(e);        
        var type=$e.children('AxisMode').text().toLowerCase();
        if(type != 'time_based_absolute') {
            console.log("TODO xaxis of type ", type);
            return null;
        }
        labelStyle.color= titleStyle.color = USS.parseColor($e.children('AxisColor')[0], 'black');
        var xaxis = {type:'datetime', gridLineDashStyle: 'dash', 
                    labels: {style: labelStyle}, startOnTick: false, gridLineWidth:1};

        var label = $e.children('Label').text();
        xaxis.title = {text: label, style: titleStyle};

        var autoRange = ($e.children('AutoRange').text().toLowerCase()=='true');
        this.xAutoRange = autoRange;
        if(!autoRange) {
            var axisRange=$e.children('AxisRange')[0];
            xaxis.min = parseFloat($(axisRange).children('Lower').text());
            xaxis.max = parseFloat($(axisRange).children('Upper').text());
            this.xRange = xaxis.max - xaxis.min;
        }
        return xaxis;
    },
    updateValue: function(para, usingRaw) {
        var series=this.chart.get('series-1');
        var value=USS.getParameterValue(para, usingRaw);
        var t=para.generationTime;
        var xaxis = series.xAxis;
        if(!this.xAutoRange) {
            var extr = xaxis.getExtremes();
            if(extr.max < t) {
                var s = this.xRange/3;
                xaxis.setExtremes(t+s-this.xRange, t+s); 
            }
        }
        series.addPoint([t,value]);
     }
});


USS.Display.createWidgetTypes(['LinearTickMeter']);
$.extend(USS.LinearTickMeter.prototype, {
    parseAndDraw: function (svg, parent, e) {
        var width = this.width;
        var height = this.height;
        
        var cx = width / 2;
        var cy = height / 2;
        
        var $e=$(e);
        var meterMin = this.meterMin = parseFloat($e.children('Minimum').text());
        var meterMax = this.meterMax = parseFloat($e.children('Maximum').text());
        var meterRange = this.meterRange = this.meterMax - this.meterMin;
        
        var orientation = $e.children('Orientation').text().toLowerCase();

        var meterHeight;
        var transform;
        if (orientation == "vertical") {
                transform = {transform: "translate(" + (this.x+15) + ", "+(this.y+10)+")"};
                meterHeight = height - 20;
        } else {
                transform = {transform: "translate(" + (width - 10)  + " " + cy + ") rotate(90)"};
                meterHeight = width - 20;
        }
        this.meterHeight=meterHeight;


        var labelStyle = $e.children('LabelStyle').text().toLowerCase();
        var drawLabels = labelStyle != "no_labels";
        var tickBase = parseFloat($e.children('TickBase').text());
        if(!tickBase) tickBase=0;
        var tickUnit = parseFloat($e.children('TickUnit').text());
        var tickMajorFreq = parseFloat($e.children('TickMajorFrequency').text());
        var tickColor = USS.parseColor($e.children('Color'), 'black');

        //svg.rect(parent, 0, 0, width, height, {fill: 'none', strokeWidth: '1px'});

        var g = svg.group(parent, transform);

        svg.rect(g, -3, 0, 6, meterHeight, {fill: 'white', stroke: 'none'});
        var that = this;
        var tickPainter = function(tick, idx) {
                var settings = {fill: 'none', stroke: tickColor, strokeWidth: '1px'};
                var pos = that.meterHeight - that.getIndicatorHeight(tick);
                // whether to do a major or minor tick
                if (idx % tickMajorFreq == 0) {
                        settings.strokeWidth = '2px';
                        svg.line(g, -8.5, pos, 8.5, pos, settings);
                        if (drawLabels) {
                                var posX = -14;
                                var textSettings = {fontSize: '10'};

                                switch (labelStyle) {
                                case "left_or_top":
                                        posX = -14;
                                        textSettings.textAnchor = 'end';
                                        break;

                                case "right_or_bottom":
                                        posX = 14;
                                        textSettings.textAnchor = 'start';
                                        break;

                                case "alternate_start_left_or_top":
                                        posX = (idx % 4 == 0) ? -14 : 14;
                                        textSettings.textAnchor = (idx % 4 == 0) ? 'end' : 'start';
                                        break;

                                case "alternate_start_right_or_bottom":
                                        posX = (idx % 4 == 0) ? 14 : -14;
                                        textSettings.textAnchor = (idx % 4 == 0) ? 'start' : 'end';
                                        break;
                                }

                                var posY;
                                if (orientation == "horizontal") {
                                        posX = -posX;
                                        if (posX == 14) {
                                                posX = posX + 5;
                                        }
                                        posY = pos;
                                        textSettings.textAnchor = 'middle';
                                        textSettings.transform = "rotate(-90 " + posX + " " + posY + ")";
                                } else {
                                        posY = pos + 3;
                                }

                                svg.text(g, posX, posY, "" + tick, textSettings);
                        }
                } else {
                        svg.line(g, -6, pos, 6, pos, settings);
                }
        };

        var idx = 0;
        var tickStart = tickBase;
        if (tickStart > this.meterMax) {
             tickStart = this.meterMax;
        }
        for (var tick = tickStart; tick >= this.meterMin; tick -= tickUnit, idx++) {
                tickPainter(tick, idx);
        }

        if (idx > 0) {
                idx = 1;
        }
        tickStart = tickBase + tickUnit;
        if (tickStart < this.meterMin) {
                tickStart = this.meterMin;
        }
        for (var tick = tickStart; tick <= this.meterMax; tick += tickUnit, idx++) {
                tickPainter(tick, idx);
        }

        settings = {id: this.id + '-indicator', fill: '#00FF00', stroke: 'black', strokeWidth: '1px'};
        svg.rect(g, -2.5, meterHeight, 6, 0, settings);
    },
    getIndicatorHeight: function(val) {
        return (val + Math.abs(this.meterMin)) / this.meterRange * this.meterHeight;
    },
    updateValue: function(para, usingRaw) {
        var value=USS.getParameterValue(para, usingRaw);
        var pos = this.getIndicatorHeight(value);
        if(pos > this.meterHeight) pos=this.meterHeight;
        var indicator=this.svg.getElementById(this.id+'-indicator');
        indicator.setAttribute('y', this.meterHeight-pos);
        indicator.setAttribute('height', pos);

     }

});


/* http://keith-wood.name/svg.html
   SVG for jQuery v1.5.0.
   Written by Keith Wood (kbwood{at}iinet.com.au) August 2007.
   Available under the MIT (http://keith-wood.name/licence.html) license. 
   Please attribute the author if you use it. */

(function($) { // Hide scope, no $ conflict

/** The SVG manager.
	<p>Use the singleton instance of this class, $.svg, 
	to interact with the SVG functionality.</p>
	<p>Expects HTML like:</p>
	<pre>&lt;div>&lt;/div></pre>
	@module SVGManager */
function SVGManager() {
	this._settings = []; // Settings to be remembered per SVG object
	this._extensions = []; // List of SVG extensions added to SVGWrapper
		// for each entry [0] is extension name, [1] is extension class (function)
		// the function takes one parameter - the SVGWrapper instance
	this.regional = []; // Localisations, indexed by language, '' for default (English)
	this.regional[''] = {errorLoadingText: 'Error loading'};
	this.local = this.regional['']; // Current localisation
	this._uuid = new Date().getTime();
	this._ie = !!window.ActiveXObject;
}

$.extend(SVGManager.prototype, {
	/** Class name added to elements to indicate already configured with SVG. */
	markerClassName: 'hasSVG',
	/** Name of the data property for instance settings. */
	propertyName: 'svgwrapper',

	/** SVG namespace. */
	svgNS: 'http://www.w3.org/2000/svg',
	/** XLink namespace. */
	xlinkNS: 'http://www.w3.org/1999/xlink',

	/** SVG wrapper class. */
	_wrapperClass: SVGWrapper,

	/* Camel-case versions of attribute names containing dashes or are reserved words. */
	_attrNames: {class_: 'class', in_: 'in',
		alignmentBaseline: 'alignment-baseline', baselineShift: 'baseline-shift',
		clipPath: 'clip-path', clipRule: 'clip-rule',
		colorInterpolation: 'color-interpolation',
		colorInterpolationFilters: 'color-interpolation-filters',
		colorRendering: 'color-rendering', dominantBaseline: 'dominant-baseline',
		enableBackground: 'enable-background', fillOpacity: 'fill-opacity',
		fillRule: 'fill-rule', floodColor: 'flood-color',
		floodOpacity: 'flood-opacity', fontFamily: 'font-family',
		fontSize: 'font-size', fontSizeAdjust: 'font-size-adjust',
		fontStretch: 'font-stretch', fontStyle: 'font-style',
		fontVariant: 'font-variant', fontWeight: 'font-weight',
		glyphOrientationHorizontal: 'glyph-orientation-horizontal',
		glyphOrientationVertical: 'glyph-orientation-vertical',
		horizAdvX: 'horiz-adv-x', horizOriginX: 'horiz-origin-x',
		imageRendering: 'image-rendering', letterSpacing: 'letter-spacing',
		lightingColor: 'lighting-color', markerEnd: 'marker-end',
		markerMid: 'marker-mid', markerStart: 'marker-start',
		stopColor: 'stop-color', stopOpacity: 'stop-opacity',
		strikethroughPosition: 'strikethrough-position',
		strikethroughThickness: 'strikethrough-thickness',
		strokeDashArray: 'stroke-dasharray', strokeDashOffset: 'stroke-dashoffset',
		strokeLineCap: 'stroke-linecap', strokeLineJoin: 'stroke-linejoin',
		strokeMiterLimit: 'stroke-miterlimit', strokeOpacity: 'stroke-opacity',
		strokeWidth: 'stroke-width', textAnchor: 'text-anchor',
		textDecoration: 'text-decoration', textRendering: 'text-rendering',
		underlinePosition: 'underline-position', underlineThickness: 'underline-thickness',
		vertAdvY: 'vert-adv-y', vertOriginY: 'vert-origin-y',
		wordSpacing: 'word-spacing', writingMode: 'writing-mode'},

	/* Add the SVG object to its container. */
	_attachSVG: function(container, settings) {
		var svg = (container.namespaceURI === this.svgNS ? container : null);
		var container = (svg ? null : container);
		if ($(container || svg).hasClass(this.markerClassName)) {
			return;
		}
		if (typeof settings === 'string') {
			settings = {loadURL: settings};
		}
		else if (typeof settings === 'function') {
			settings = {onLoad: settings};
		}
		$(container || svg).addClass(this.markerClassName);
		try {
			if (!svg) {
				svg = document.createElementNS(this.svgNS, 'svg');
				svg.setAttribute('version', '1.1');
				if (container.clientWidth > 0) {
					svg.setAttribute('width', container.clientWidth);
				}
				if (container.clientHeight > 0) {
					svg.setAttribute('height', container.clientHeight);
				}
				container.appendChild(svg);
			}
			this._afterLoad(container, svg, settings || {});
		}
		catch (e) {
			$(container).html('<p>SVG is not supported natively on this browser</p>');
		}
	},

	/* Post-processing once loaded. */
	_afterLoad: function(container, svg, settings) {
		var settings = settings || this._settings[container.id];
		this._settings[container ? container.id : ''] = null;
		var wrapper = new this._wrapperClass(svg, container);
		$.data(container || svg, $.svg.propertyName, wrapper);
		try {
			if (settings.loadURL) { // Load URL
				wrapper.load(settings.loadURL, settings);
			}
			if (settings.settings) { // Additional settings
				wrapper.configure(settings.settings);
			}
			if (settings.onLoad && !settings.loadURL) { // Onload callback
				settings.onLoad.apply(container || svg, [wrapper]);
			}
		}
		catch (e) {
			alert(e);
		}
	},

	/** Return the SVG wrapper created for a given container.
		@param container {string|Element|jQuery} Selector for the container or
				the container for the SVG object or jQuery collection where first entry is the container.
		@return {SVGWrapper} The corresponding SVG wrapper element, or <code>null</code> if not attached. */
	_getSVG: function(container) {
		return $(container).data(this.propertyName);
	},

	/** Remove the SVG functionality from a div.
		@param container {Element} The container for the SVG object. */
	_destroySVG: function(container) {
		container = $(container);
		if (!container.hasClass(this.markerClassName)) {
			return;
		}
		container.removeClass(this.markerClassName).removeData(this.propertyName);
		if (container[0].namespaceURI !== this.svgNS) {
			container.empty();
		}
	},

	/** Extend the SVGWrapper object with an embedded class.
		<p>The constructor function must take a single parameter that is
	   a reference to the owning SVG root object. This allows the 
		extension to access the basic SVG functionality.</p>
		@param name {string} The name of the <code>SVGWrapper</code> attribute to access the new class.
		@param extClass {function} The extension class constructor. */
	addExtension: function(name, extClass) {
		this._extensions.push([name, extClass]);
	},

	/** Does this node belong to SVG?
		@param node {Element} The node to be tested.
		@return {boolean} <code>true</code> if an SVG node, <code>false</code> if not. */
	isSVGElem: function(node) {
		return (node.nodeType === 1 && node.namespaceURI === $.svg.svgNS);
	}
});

/** The main SVG interface, which encapsulates the SVG element.
	<p>Obtain a reference from $().svg('get')</p>
	@module SVGWrapper */
function SVGWrapper(svg, container) {
	this._svg = svg; // The SVG root node
	this._container = container; // The containing div
	for (var i = 0; i < $.svg._extensions.length; i++) {
		var extension = $.svg._extensions[i];
		this[extension[0]] = new extension[1](this);
	}
}

$.extend(SVGWrapper.prototype, {

	/** Retrieve the width of the SVG object.
		@return {number} The width of the SVG canvas. */
	width: function() {
		return (this._container ? this._container.clientWidth : this._svg.width);
	},

	/** Retrieve the height of the SVG object.
		@return {number} The height of the SVG canvas. */
	height: function() {
		return (this._container ? this._container.clientHeight : this._svg.height);
	},

	/** Retrieve the root SVG element.
		@return {SVGElement} The top-level SVG element. */
	root: function() {
		return this._svg;
	},

	/** Configure a SVG node.
		@param [node] {SVGElement} The node to configure, or the SVG root if not specified.
		@param settings {object} Additional settings for the root.
		@param [clear=false] {boolean} <code>true</code> to remove existing attributes first,
				<code>false</code> to add to what is already there.
		@return {SVGWrapper} This wrapper. */
	configure: function(node, settings, clear) {
		if (!node.nodeName) {
			clear = settings;
			settings = node;
			node = this._svg;
		}
		if (clear) {
			for (var i = node.attributes.length - 1; i >= 0; i--) {
				var attr = node.attributes.item(i);
				if (!(attr.nodeName === 'onload' || attr.nodeName === 'version' || 
						attr.nodeName.substring(0, 5) === 'xmlns')) {
					node.attributes.removeNamedItem(attr.nodeName);
				}
			}
		}
		for (var attrName in settings) {
			node.setAttribute($.svg._attrNames[attrName] || attrName, settings[attrName]);
		}
		return this;
	},

	/** Locate a specific element in the SVG document.
		@param id {string} The element's identifier.
		@return {SVGElement} The element reference, or <code>null</code> if not found. */
	getElementById: function(id) {
		return this._svg.ownerDocument.getElementById(id);
	},

	/** Change the attributes for a SVG node.
		@param element {SVGElement} The node to change.
		@param settings {object} The new settings.
		@return {SVGWrapper} This wrapper. */
	change: function(element, settings) {
		if (element) {
			for (var name in settings) {
				if (settings[name] == null) {
					element.removeAttribute($.svg._attrNames[name] || name);
				}
				else {
					element.setAttribute($.svg._attrNames[name] || name, settings[name]);
				}
			}
		}
		return this;
	},

	/** Check for parent being absent and adjust arguments accordingly.
		@private
		@param values {string[]} The given parameters.
		@param names {string[]} The names of the parameters in order.
		@param optSettings {string[]} The names of optional parameters.
		@return {object} An object representing the named parameters. */
	_args: function(values, names, optSettings) {
		names.splice(0, 0, 'parent');
		names.splice(names.length, 0, 'settings');
		var args = {};
		var offset = 0;
		if (values[0] != null && values[0].jquery) {
			values[0] = values[0][0];
		}
		if (values[0] != null && !(typeof values[0] === 'object' && values[0].nodeName)) {
			args['parent'] = null;
			offset = 1;
		}
		for (var i = 0; i < values.length; i++) {
			args[names[i + offset]] = values[i];
		}
		if (optSettings) {
			$.each(optSettings, function(i, value) {
				if (typeof args[value] === 'object') {
					args.settings = args[value];
					args[value] = null;
				}
			});
		}
		return args;
	},

	/** Add a title.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param text {string} The text of the title.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new title node. */
	title: function(parent, text, settings) {
		var args = this._args(arguments, ['text']);
		var node = this._makeNode(args.parent, 'title', args.settings || {});
		node.appendChild(this._svg.ownerDocument.createTextNode(args.text));
		return node;
	},

	/** Add a description.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param text {string} The text of the description.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new description node. */
	describe: function(parent, text, settings) {
		var args = this._args(arguments, ['text']);
		var node = this._makeNode(args.parent, 'desc', args.settings || {});
		node.appendChild(this._svg.ownerDocument.createTextNode(args.text));
		return node;
	},

	/** Add a definitions node.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param [id] {string} The ID of this definitions (optional).
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new definitions node. */
	defs: function(parent, id, settings) {
		var args = this._args(arguments, ['id'], ['id']);
		return this._makeNode(args.parent, 'defs', $.extend((args.id ? {id: args.id} : {}), args.settings || {}));
	},

	/** Add a symbol definition.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID of this symbol.
		@param x1 {number} The left coordinate for this symbol.
		@param y1 {number} The top coordinate for this symbol.
		@param width {number} The width of this symbol.
		@param height {number} The height of this symbol.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new symbol node. */
	symbol: function(parent, id, x1, y1, width, height, settings) {
		var args = this._args(arguments, ['id', 'x1', 'y1', 'width', 'height']);
		return this._makeNode(args.parent, 'symbol', $.extend({id: args.id,
				viewBox: args.x1 + ' ' + args.y1 + ' ' + args.width + ' ' + args.height}, args.settings || {}));
	},

	/** Add a marker definition.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID of this marker.
		@param refX {number} The x-coordinate for the reference point.
		@param refY {number} The y-coordinate for the reference point.
		@param mWidth {number} The marker viewport width.
		@param mHeight {number} The marker viewport height.
		@param [orient] {string|number} 'auto' or angle (degrees).
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new marker node. */
	marker: function(parent, id, refX, refY, mWidth, mHeight, orient, settings) {
		var args = this._args(arguments, ['id', 'refX', 'refY', 'mWidth', 'mHeight', 'orient'], ['orient']);
		return this._makeNode(args.parent, 'marker', $.extend(
			{id: args.id, refX: args.refX, refY: args.refY, markerWidth: args.mWidth, 
			markerHeight: args.mHeight, orient: args.orient || 'auto'}, args.settings || {}));
	},

	/** Add a style node.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param styles {string} The CSS styles.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new style node. */
	style: function(parent, styles, settings) {
		var args = this._args(arguments, ['styles']);
		var node = this._makeNode(args.parent, 'style', $.extend({type: 'text/css'}, args.settings || {}));
		node.appendChild(this._svg.ownerDocument.createTextNode(args.styles));
		return node;
	},

	/** Add a script node.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param script {string} The JavaScript code.
		@param [type='text/javascript'] {string} The MIME type for the code.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new script node. */
	script: function(parent, script, type, settings) {
		var args = this._args(arguments, ['script', 'type'], ['type']);
		var node = this._makeNode(args.parent, 'script', $.extend(
			{type: args.type || 'text/javascript'}, args.settings || {}));
		node.appendChild(this._svg.ownerDocument.createTextNode(args.script));
		if ($.svg._ie) {
			$.globalEval(args.script);
		}
		return node;
	},

	/** Add a linear gradient definition.
		<p>Specify all of <code>x1</code>, <code>y1</code>, <code>x2</code>, <code>y2</code> or none of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID for this gradient.
		@param stops {string[][]} The gradient stops, each entry is [0] is offset (0.0-1.0 or 0%-100%),
				[1] is colour, [2] is opacity (optional).
		@param [x1] {number} The x-coordinate of the gradient start.
		@param [y1] {number} The y-coordinate of the gradient start.
		@param [x2] {number} The x-coordinate of the gradient end.
		@param [y2] {number} The y-coordinate of the gradient end.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new linear gradient node. */
	linearGradient: function(parent, id, stops, x1, y1, x2, y2, settings) {
		var args = this._args(arguments, ['id', 'stops', 'x1', 'y1', 'x2', 'y2'], ['x1']);
		var sets = $.extend({id: args.id},
				(args.x1 != null ? {x1: args.x1, y1: args.y1, x2: args.x2, y2: args.y2} : {}));
		return this._gradient(args.parent, 'linearGradient', $.extend(sets, args.settings || {}), args.stops);
	},

	/** Add a radial gradient definition.
		<p>Specify all of <code>cx</code>, <code>cy</code>, <code>r</code>,
		<code>fx</code>, <code>fy</code> or none of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID for this gradient.
		@param stops {string[][]} The gradient stops, each entry [0] is offset (0.0-1.0 or 0%-100%),
				[1] is colour, [2] is opacity (optional).
		@param [cx] {number} The x-coordinate of the largest circle centre.
		@param [cy] {number} The y-coordinate of the largest circle centre.
		@param [r] {number} The radius of the largest circle.
		@param [fx] {number} The x-coordinate of the gradient focus.
		@param [fy] {number} The y-coordinate of the gradient focus.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new radial gradient node. */
	radialGradient: function(parent, id, stops, cx, cy, r, fx, fy, settings) {
		var args = this._args(arguments, ['id', 'stops', 'cx', 'cy', 'r', 'fx', 'fy'], ['cx']);
		var sets = $.extend({id: args.id},
			(args.cx != null ? {cx: args.cx, cy: args.cy, r: args.r, fx: args.fx, fy: args.fy} : {}));
		return this._gradient(args.parent, 'radialGradient', $.extend(sets, args.settings || {}), args.stops);
	},

	/** Add a gradient node.
		@private
		@param parent {SVGElement|jQuery} The parent node for the new node.
		@param name {string} The type of gradient node to create.
		@param settings {object} The settings for this node.
		@param stops {string[][]} The gradient stops.
		@return {SVGElement} The new gradient node. */
	_gradient: function(parent, name, settings, stops) {
		var node = this._makeNode(parent, name, settings);
		for (var i = 0; i < stops.length; i++) {
			var stop = stops[i];
			this._makeNode(node, 'stop', $.extend({offset: stop[0], stopColor: stop[1]}, 
				(stop[2] != null ? {stopOpacity: stop[2]} : {})));
		}
		return node;
	},

	/** Add a pattern definition.
		<p>Specify all of <code>vx</code>, <code>vy</code>, <code>xwidth</code>,
		<code>vheight</code> or none of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID for this pattern.
		@param x {number} The x-coordinate for the left edge of the pattern.
		@param y {number} The y-coordinate for the top edge of the pattern.
		@param width {number} The width of the pattern.
		@param height {number} The height of the pattern.
		@param [vx] {number} The minimum x-coordinate for view box.
		@param [vy] {number} The minimum y-coordinate for the view box.
		@param [vwidth] {number} The width of the view box.
		@param [vheight] {number} The height of the view box.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new pattern definition node. */
	pattern: function(parent, id, x, y, width, height, vx, vy, vwidth, vheight, settings) {
		var args = this._args(arguments, ['id', 'x', 'y', 'width', 'height', 'vx', 'vy', 'vwidth', 'vheight'], ['vx']);
		var sets = $.extend({id: args.id, x: args.x, y: args.y, width: args.width, height: args.height},
			(args.vx != null ? {viewBox: args.vx + ' ' + args.vy + ' ' + args.vwidth + ' ' + args.vheight} : {}));
		return this._makeNode(args.parent, 'pattern', $.extend(sets, args.settings || {}));
	},

	/** Add a clip path definition.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID for this path.
		@param [units='userSpaceOnUse'] {string} Either 'userSpaceOnUse' or 'objectBoundingBox'.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new clip path definition node. */
	clipPath: function(parent, id, units, settings) {
		var args = this._args(arguments, ['id', 'units']);
		args.units = args.units || 'userSpaceOnUse';
		return this._makeNode(args.parent, 'clipPath', $.extend(
			{id: args.id, clipPathUnits: args.units}, args.settings || {}));
	},

	/** Add a mask definition.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param id {string} The ID for this mask.
		@param x {number} The x-coordinate for the left edge of the mask.
		@param y {number} The y-coordinate for the top edge of the mask.
		@param width {number} The width of the mask.
		@param height {number} The height of the mask.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new mask definition node. */
	mask: function(parent, id, x, y, width, height, settings) {
		var args = this._args(arguments, ['id', 'x', 'y', 'width', 'height']);
		return this._makeNode(args.parent, 'mask', $.extend(
			{id: args.id, x: args.x, y: args.y, width: args.width, height: args.height}, args.settings || {}));
	},

	/** Create a new path object.
		@return {SVGPath} A new path object. */
	createPath: function() {
		return new SVGPath();
	},

	/** Create a new text object.
		@return {SVGText} A new text object. */
	createText: function() {
		return new SVGText();
	},

	/** Add an embedded SVG element.
		<p>Specify all of <code>vx</code>, <code>vy</code>,
		<code>vwidth</code>, <code>vheight</code> or none of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param x {number} The x-coordinate for the left edge of the node.
		@param y {number} The y-coordinate for the top edge of the node.
		@param width {number} The width of the node.
		@param height {number} The height of the node.
		@param [vx] {number} The minimum x-coordinate for view box.
		@param [vy] {number} The minimum y-coordinate for the view box.
		@param [vwidth] {number} The width of the view box.
		@param [vheight] {number} The height of the view box.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new svg node. */
	svg: function(parent, x, y, width, height, vx, vy, vwidth, vheight, settings) {
		var args = this._args(arguments, ['x', 'y', 'width', 'height', 'vx', 'vy', 'vwidth', 'vheight'], ['vx']);
		var sets = $.extend({x: args.x, y: args.y, width: args.width, height: args.height}, 
			(args.vx != null ? {viewBox: args.vx + ' ' + args.vy + ' ' + args.vwidth + ' ' + args.vheight} : {}));
		return this._makeNode(args.parent, 'svg', $.extend(sets, args.settings || {}));
	},

	/** Create a group.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param [id] {string} The ID of this group.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new group node. */
	group: function(parent, id, settings) {
		var args = this._args(arguments, ['id'], ['id']);
		return this._makeNode(args.parent, 'g', $.extend({id: args.id}, args.settings || {}));
	},

	/** Add a usage reference.
		<p>Specify all of <code>x</code>, <code>y</code>, <code>width</code>, <code>height</code> or none of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param [x] {number} The x-coordinate for the left edge of the node.
		@param [y] {number} The y-coordinate for the top edge of the node.
		@param [width] {number} The width of the node.
		@param [height] {number} The height of the node.
		@param ref {string} The ID of the definition node.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new usage reference node. */
	use: function(parent, x, y, width, height, ref, settings) {
		var args = this._args(arguments, ['x', 'y', 'width', 'height', 'ref']);
		if (typeof args.x === 'string') {
			args.ref = args.x;
			args.settings = args.y;
			args.x = args.y = args.width = args.height = null;
		}
		var node = this._makeNode(args.parent, 'use', $.extend(
			{x: args.x, y: args.y, width: args.width, height: args.height}, args.settings || {}));
		node.setAttributeNS($.svg.xlinkNS, 'href', args.ref);
		return node;
	},

	/** Add a link, which applies to all child elements.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param ref {string} The target URL.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new link node. */
	link: function(parent, ref, settings) {
		var args = this._args(arguments, ['ref']);
		var node = this._makeNode(args.parent, 'a', args.settings);
		node.setAttributeNS($.svg.xlinkNS, 'href', args.ref);
		return node;
	},

	/** Add an image.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param x {number} The x-coordinate for the left edge of the image.
		@param y {number} The y-coordinate for the top edge of the image.
		@param width {number} The width of the image.
		@param height {number} The height of the image.
		@param ref {string} The path to the image.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new image node. */
	image: function(parent, x, y, width, height, ref, settings) {
		var args = this._args(arguments, ['x', 'y', 'width', 'height', 'ref']);
		var node = this._makeNode(args.parent, 'image', $.extend(
			{x: args.x, y: args.y, width: args.width, height: args.height}, args.settings || {}));
		node.setAttributeNS($.svg.xlinkNS, 'href', args.ref);
		return node;
	},

	/** Draw a path.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param path {string|SVGPath} The path to draw.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new path node. */
	path: function(parent, path, settings) {
		var args = this._args(arguments, ['path']);
		return this._makeNode(args.parent, 'path', $.extend(
			{d: (args.path.path ? args.path.path() : args.path)}, args.settings || {}));
	},

	/** Draw a rectangle.
		<p>Specify both of <code>rx</code> and <code>ry</code> or neither.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param x {number} The x-coordinate for the left edge of the rectangle.
		@param y {number} The y-coordinate for the top edge of the rectangle.
		@param width {number} The width of the rectangle.
		@param height {number} The height of the rectangle.
		@param [rx] {number} The x-radius of the ellipse for the rounded corners.
		@param [ry] {number} The y-radius of the ellipse for the rounded corners.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new rectangle node. */
	rect: function(parent, x, y, width, height, rx, ry, settings) {
		var args = this._args(arguments, ['x', 'y', 'width', 'height', 'rx', 'ry'], ['rx']);
		return this._makeNode(args.parent, 'rect', $.extend(
			{x: args.x, y: args.y, width: args.width, height: args.height},
			(args.rx ? {rx: args.rx, ry: args.ry} : {}), args.settings || {}));
	},

	/** Draw a circle.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param cx {number} The x-coordinate for the centre of the circle.
		@param cy {number} The y-coordinate for the centre of the circle.
		@param r {number} The radius of the circle.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new circle node. */
	circle: function(parent, cx, cy, r, settings) {
		var args = this._args(arguments, ['cx', 'cy', 'r']);
		return this._makeNode(args.parent, 'circle', $.extend(
			{cx: args.cx, cy: args.cy, r: args.r}, args.settings || {}));
	},

	/** Draw an ellipse.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param cx {number} The x-coordinate for the centre of the ellipse.
		@param cy {number} The y-coordinate for the centre of the ellipse.
		@param rx {number} The x-radius of the ellipse.
		@param ry {number} The y-radius of the ellipse.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new ellipse node. */
	ellipse: function(parent, cx, cy, rx, ry, settings) {
		var args = this._args(arguments, ['cx', 'cy', 'rx', 'ry']);
		return this._makeNode(args.parent, 'ellipse', $.extend(
			{cx: args.cx, cy: args.cy, rx: args.rx, ry: args.ry}, args.settings || {}));
	},

	/** Draw a line.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param x1 {number} The x-coordinate for the start of the line.
		@param y1 {number} The y-coordinate for the start of the line.
		@param x2 {number} The x-coordinate for the end of the line.
		@param y2 {number} The y-coordinate for the end of the line.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new line node. */
	line: function(parent, x1, y1, x2, y2, settings) {
		var args = this._args(arguments, ['x1', 'y1', 'x2', 'y2']);
		return this._makeNode(args.parent, 'line', $.extend(
			{x1: args.x1, y1: args.y1, x2: args.x2, y2: args.y2}, args.settings || {}));
	},

	/** Draw a polygonal line.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param points {number[][]} The x-/y-coordinates for the points on the line.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new polygonal line node. */
	polyline: function(parent, points, settings) {
		var args = this._args(arguments, ['points']);
		return this._poly(args.parent, 'polyline', args.points, args.settings);
	},

	/** Draw a polygonal shape.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param points {number[][]} The x-/y-coordinates for the points on the shape.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new polygonal shape node. */
	polygon: function(parent, points, settings) {
		var args = this._args(arguments, ['points']);
		return this._poly(args.parent, 'polygon', args.points, args.settings);
	},

	/** Draw a polygonal line or shape.
		@private
		@param parent {SVGElement|jQuery} The parent node for the new node.
		@param name {string} The type of polygon to create.
		@param points {number[][]} The x-/y-coordinates for the points on the shape.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new polygon node. */
	_poly: function(parent, name, points, settings) {
		var ps = '';
		for (var i = 0; i < points.length; i++) {
			ps += points[i].join() + ' ';
		}
		return this._makeNode(parent, name, $.extend({points: $.trim(ps)}, settings || {}));
	},

	/** Draw text.
		<p>Specify both of <code>x</code> and <code>y</code> or neither of them.</p>
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param [x] {number|number[]} The x-coordinate(s) for the text.
		@param [y] {number|number[]} The y-coordinate(s) for the text.
		@param value {string|SVGText} The text content or text with spans and references.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new text node. */
	text: function(parent, x, y, value, settings) {
		var args = this._args(arguments, ['x', 'y', 'value']);
		if (typeof args.x === 'string' && arguments.length < 4) {
			args.value = args.x;
			args.settings = args.y;
			args.x = args.y = null;
		}
		return this._text(args.parent, 'text', args.value, $.extend(
			{x: (args.x && $.isArray(args.x) ? args.x.join(' ') : args.x),
			y: (args.y && $.isArray(args.y) ? args.y.join(' ') : args.y)}, args.settings || {}));
	},

	/** Draw text along a path.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param path {string} The ID of the path.
		@param value {string|SVGText} The text content or text with spans and references.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new textpath node. */
	textpath: function(parent, path, value, settings) {
		var args = this._args(arguments, ['path', 'value']);
		var node = this._text(args.parent, 'textPath', args.value, args.settings || {});
		node.setAttributeNS($.svg.xlinkNS, 'href', args.path);
		return node;
	},

	/** Draw text.
		@private
		@param parent {SVGElement|jQuery} The parent node for the new node.
		@param name {string} The type of text to create.
		@param value {string|SVGText} The text content or text with spans and references.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new text node. */
	_text: function(parent, name, value, settings) {
		var node = this._makeNode(parent, name, settings);
		if (typeof value === 'string') {
			node.appendChild(node.ownerDocument.createTextNode(value));
		}
		else {
			for (var i = 0; i < value._parts.length; i++) {
				var part = value._parts[i];
				if (part[0] === 'tspan') {
					var child = this._makeNode(node, part[0], part[2]);
					child.appendChild(node.ownerDocument.createTextNode(part[1]));
					node.appendChild(child);
				}
				else if (part[0] === 'tref') {
					var child = this._makeNode(node, part[0], part[2]);
					child.setAttributeNS($.svg.xlinkNS, 'href', part[1]);
					node.appendChild(child);
				}
				else if (part[0] === 'textpath') {
					var set = $.extend({}, part[2]);
					set.href = null;
					var child = this._makeNode(node, part[0], set);
					child.setAttributeNS($.svg.xlinkNS, 'href', part[2].href);
					child.appendChild(node.ownerDocument.createTextNode(part[1]));
					node.appendChild(child);
				}
				else { // straight text
					node.appendChild(node.ownerDocument.createTextNode(part[1]));
				}
			}
		}
		return node;
	},

	/** Add a custom SVG element.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param name {string} The name of the element.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new custom node. */
	other: function(parent, name, settings) {
		var args = this._args(arguments, ['name']);
		return this._makeNode(args.parent, args.name, args.settings || {});
	},

	/** Create a SVG node with the given settings.
		@private
		@param parent {SVGElement|jQuery} The parent node for the new node, or SVG root if <code>null</code>.
		@param name {string} The name of the element.
		@param [settings] {object} Additional settings for this node.
		@return {SVGElement} The new node. */
	_makeNode: function(parent, name, settings) {
		parent = parent || this._svg;
		var node = this._svg.ownerDocument.createElementNS($.svg.svgNS, name);
		for (var name in settings) {
			var value = settings[name];
			if (value != null && (typeof value !== 'string' || value !== '')) {
				node.setAttribute($.svg._attrNames[name] || name, value);
			}
		}
		parent.appendChild(node);
		return node;
	},

	/** Add an existing SVG node to the document.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param node {SVGElement|string|jQuery} The new node to add or
				the jQuery selector for the node or the set of nodes to add.
		@return {SVGWrapper} This wrapper. */
	add: function(parent, node) {
		var args = this._args((arguments.length === 1 ? [null, parent] : arguments), ['node']);
		var svg = this;
		args.parent = args.parent || this._svg;
		args.node = (args.node.jquery ? args.node : $(args.node));
		try {
			args.parent.appendChild(args.node.cloneNode(true));
		}
		catch (e) {
			args.node.each(function() {
				var child = svg._cloneAsSVG(this);
				if (child) {
					args.parent.appendChild(child);
				}
			});
		}
		return this;
	},

	/** Clone an existing SVG node and add it to the document.
		@param [parent] {SVGElement|jQuery} The parent node for the new node, or SVG root if not specified.
		@param node {SVGEelement|string|jQuery} The new node to add or
				the jQuery selector for the node or the set of nodes to clone.
		@return {SVGElement[]} The collection of new nodes. */
	clone: function(parent, node) {
		var svg = this;
		var args = this._args((arguments.length === 1 ? [null, parent] : arguments), ['node']);
		args.parent = args.parent || this._svg;
		args.node = (args.node.jquery ? args.node : $(args.node));
		var newNodes = [];
		args.node.each(function() {
			var child = svg._cloneAsSVG(this);
			if (child) {
				child.id = '';
				args.parent.appendChild(child);
				newNodes.push(child);
			}
		});
		return newNodes;
	},

	/** SVG nodes must belong to the SVG namespace, so clone and ensure this is so.
		@private
		@param node {SVGElement} The SVG node to clone.
		@return {SVGElement} The cloned node. */
	_cloneAsSVG: function(node) {
		var newNode = null;
		if (node.nodeType === 1) { // element
			newNode = this._svg.ownerDocument.createElementNS($.svg.svgNS, this._checkName(node.nodeName));
			for (var i = 0; i < node.attributes.length; i++) {
				var attr = node.attributes.item(i);
				if (attr.nodeName !== 'xmlns' && attr.nodeValue) {
					if (attr.prefix === 'xlink') {
						newNode.setAttributeNS($.svg.xlinkNS, attr.localName || attr.baseName, attr.nodeValue);
					}
					else {
						newNode.setAttribute(this._checkName(attr.nodeName), attr.nodeValue);
					}
				}
			}
			for (var i = 0; i < node.childNodes.length; i++) {
				var child = this._cloneAsSVG(node.childNodes[i]);
				if (child) {
					newNode.appendChild(child);
				}
			}
		}
		else if (node.nodeType === 3) { // text
			if ($.trim(node.nodeValue)) {
				newNode = this._svg.ownerDocument.createTextNode(node.nodeValue);
			}
		}
		else if (node.nodeType === 4) { // CDATA
			if ($.trim(node.nodeValue)) {
				try {
					newNode = this._svg.ownerDocument.createCDATASection(node.nodeValue);
				}
				catch (e) {
					newNode = this._svg.ownerDocument.createTextNode(
						node.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
				}
			}
		}
		return newNode;
	},

	/** Node names must be lower case and without SVG namespace prefix.
		@private
		@param name {string} The name to check.
		@return {string} The corrected name. */
	_checkName: function(name) {
		name = (name.substring(0, 1) >= 'A' && name.substring(0, 1) <= 'Z' ? name.toLowerCase() : name);
		return (name.substring(0, 4) === 'svg:' ? name.substring(4) : name);
	},

	/** Load an external SVG document.
		@param url {string} The location of the SVG document or
				the actual SVG content (starting with '<code>&lt;svg</code>'.
		@param settings {boolean|function|object} Either <code>addTo</code> below or <code>onLoad</code> below or
				additional settings for the load with attributes below:
				<code>addTo</code> {boolean} <code>true</code> to add to what's already there,
				or <code>false</code> to clear the canvas first,
				<code>changeSize</code> {boolean} <code>true</code> to allow the canvas size to change,
				or <code>false</code> to retain the original,
				<code>onLoad</code> {function} callback after the document has loaded,
				'<code>this</code>' is the container, receives SVG object and optional error message as a parameter,
				<code>parent</code> {string|SVGElement|jQuery} the parent to load into,
				defaults to top-level svg element.
		@return {SVGWrapper} This wrapper. */
	load: function(url, settings) {
		settings = (typeof settings === 'boolean' ? {addTo: settings} :
				(typeof settings === 'function' ? {onLoad: settings} :
				(typeof settings === 'string' ? {parent: settings} : 
				(typeof settings === 'object' && settings.nodeName ? {parent: settings} :
				(typeof settings === 'object' && settings.jquery ? {parent: settings} : settings || {})))));
		if (!settings.parent && !settings.addTo) {
			this.clear(false);
		}
		var size = [this._svg.getAttribute('width'), this._svg.getAttribute('height')];
		var wrapper = this;
		// Report a problem with the load
		var reportError = function(message) {
			message = $.svg.local.errorLoadingText + ': ' + message;
			if (settings.onLoad) {
				settings.onLoad.apply(wrapper._container || wrapper._svg, [wrapper, message]);
			}
			else {
				wrapper.text(null, 10, 20, message);
			}
		};
		// Create a DOM from SVG content
		var loadXML4IE = function(data) {
			var xml = new ActiveXObject('Microsoft.XMLDOM');
			xml.validateOnParse = false;
			xml.resolveExternals = false;
			xml.async = false;
			xml.loadXML(data);
			if (xml.parseError.errorCode !== 0) {
				reportError(xml.parseError.reason);
				return null;
			}
			return xml;
		};
		// Load the SVG DOM
		var loadSVG = function(data) {
			if (!data) {
				return;
			}
			if (data.documentElement.nodeName !== 'svg') {
				var errors = data.getElementsByTagName('parsererror');
				var messages = (errors.length ? errors[0].getElementsByTagName('div') : []); // Safari
				reportError(!errors.length ? '???' : (messages.length ? messages[0] : errors[0]).firstChild.nodeValue);
				return;
			}
			var parent = (settings.parent ? $(settings.parent)[0] : wrapper._svg);
			var attrs = {};
			for (var i = 0; i < data.documentElement.attributes.length; i++) {
				var attr = data.documentElement.attributes.item(i);
				if (!(attr.nodeName === 'version' || attr.nodeName.substring(0, 5) === 'xmlns')) {
					attrs[attr.nodeName] = attr.nodeValue;
				}
			}
			wrapper.configure(parent, attrs, !settings.parent);
			var nodes = data.documentElement.childNodes;
			for (var i = 0; i < nodes.length; i++) {
				try {
					parent.appendChild(wrapper._svg.ownerDocument.importNode(nodes[i], true));
					if (nodes[i].nodeName === 'script') {
						$.globalEval(nodes[i].textContent);
					}
				}
				catch (e) {
					wrapper.add(parent, nodes[i]);
				}
			}
			if (!settings.keepRelativeLinks && url.match('/')) {
				var base = url.replace(/\/[^\/]*$/, '/');
				$('*', parent).each(function() {
					var href = $(this).attr('xlink:href');
					if (href && !href.match(/(^[a-z][-a-z0-9+.]*:.*$)|(^\/.*$)|(^#.*$)/i)) {
						$(this).attr('xlink:href', base + href);
					}
				});
			}
			if (!settings.changeSize) {
				wrapper.configure(parent, {width: size[0], height: size[1]});
			}
			if (settings.onLoad) {
				settings.onLoad.apply(wrapper._container || wrapper._svg, [wrapper]);
			}
		};
		if (url.match('<svg')) { // Inline SVG
			try {
				loadSVG(new DOMParser().parseFromString(url, 'text/xml'));
			} catch (e) {
				reportError(e);
			}
		}
		else { // Remote SVG
			$.ajax({url: url, dataType: 'xml',
				success: function(xml) {
					loadSVG(xml);
				}, error: function(http, message, exc) {
					reportError(message + (exc ? ' ' + exc.message : ''));
				}});
		}
		return this;
	},

	/** Delete a specified node.
		@param node {SVGElement|jQuery} The drawing node to remove.
		@return {SVGWrapper} This wrapper. */
	remove: function(node) {
		node = (node.jquery ? node[0] : node);
		node.parentNode.removeChild(node);
		return this;
	},

	/** Delete everything in the current document.
		@param [attrsToo=false] {boolean} <code>true</code> to clear any root attributes as well,
				<code>false</code> to leave them.
		@return {SVGWrapper} This wrapper. */
	clear: function(attrsToo) {
		if (attrsToo) {
			this.configure({}, true);
		}
		while (this._svg.firstChild) {
			this._svg.removeChild(this._svg.firstChild);
		}
		return this;
	},

	/** Serialise the current diagram into an SVG text document.
		@param [node] {SVGElement} The starting node, or SVG root if not specified .
		@return {string} The SVG as text. */
	toSVG: function(node) {
		node = node || this._svg;
		return (typeof XMLSerializer === 'undefined' ? this._toSVG(node) : new XMLSerializer().serializeToString(node));
	},

	/** Serialise one node in the SVG hierarchy.
		@private
		@param node {SVGElement} The current node to serialise.
		@return {string} The serialised SVG. */
	_toSVG: function(node) {
		var svgDoc = '';
		if (!node) {
			return svgDoc;
		}
		if (node.nodeType === 3) { // Text
			svgDoc = node.nodeValue;
		}
		else if (node.nodeType === 4) { // CDATA
			svgDoc = '<![CDATA[' + node.nodeValue + ']]>';
		}
		else { // Element
			svgDoc = '<' + node.nodeName;
			if (node.attributes) {
				for (var i = 0; i < node.attributes.length; i++) {
					var attr = node.attributes.item(i);
					if (!($.trim(attr.nodeValue) === '' || attr.nodeValue.match(/^\[object/) ||
							attr.nodeValue.match(/^function/))) {
						svgDoc += ' ' + (attr.namespaceURI === $.svg.xlinkNS ? 'xlink:' : '') +
							attr.nodeName + '="' + attr.nodeValue + '"';
					}
				}
			}	
			if (node.firstChild) {
				svgDoc += '>';
				var child = node.firstChild;
				while (child) {
					svgDoc += this._toSVG(child);
					child = child.nextSibling;
				}
				svgDoc += '</' + node.nodeName + '>';
			}
				else {
				svgDoc += '/>';
			}
		}
		return svgDoc;
	}
});

/** Helper to generate an SVG path.
	<p>Obtain an instance from the SVGWrapper object.</p>
	<p>String calls together to generate the path and use its value:</p>
	@module SVGPath
	@example var path = root.createPath();
   root.path(null, path.move(100, 100).line(300, 100).line(200, 300).close(), {fill: 'red'});
 // or
   root.path(null, path.move(100, 100).line([[300, 100], [200, 300]]).close(), {fill: 'red'}); */
function SVGPath() {
	this._path = '';
}

$.extend(SVGPath.prototype, {
	/** Prepare to create a new path.
		@return {SVGPath} This path. */
	reset: function() {
		this._path = '';
		return this;
	},

	/** Move the pointer to a position.
		@param x {number|number[][]} x-coordinate to move to or x-/y-coordinates to move to.
		@param [y] {number} y-coordinate to move to (omitted if <code>x</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	move: function(x, y, relative) {
		relative = ($.isArray(x) ? y : relative);
		return this._coords((relative ? 'm' : 'M'), x, y);
	},

	/** Draw a line to a position.
		@param x {number|number[][]} x-coordinate to move to or x-/y-coordinates to move to.
		@param [y] {number} y-coordinate to move to (omitted if <code>x</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	line: function(x, y, relative) {
		relative = ($.isArray(x) ? y : relative);
		return this._coords((relative ? 'l' : 'L'), x, y);
	},

	/** Draw a horizontal line to a position.
		@param x {number|number[]} x-coordinate to draw to or x-coordinates to draw to.
		@param relative {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	horiz: function(x, relative) {
		this._path += (relative ? 'h' : 'H') + ($.isArray(x) ? x.join(' ') : x);
		return this;
	},

	/** Draw a vertical line to a position.
		@param y {number|number[]} y-coordinate to draw to or y-coordinates to draw to.
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	vert: function(y, relative) {
		this._path += (relative ? 'v' : 'V') + ($.isArray(y) ? y.join(' ') : y);
		return this;
	},

	/** Draw a cubic Bézier curve.
		@param x1 {number|number[][]} x-coordinate of beginning control point or
				x-/y-coordinates of control and end points to draw to.
		@param [y1] {number} y-coordinate of beginning control point (omitted if <code>x1</code> is array).
		@param [x2] {number} x-coordinate of ending control point (omitted if <code>x1</code> is array).
		@param [y2] {number} y-coordinate of ending control point (omitted if <code>x1</code> is array).
		@param [x] {number} x-coordinate of curve end (omitted if <code>x1</code> is array).
		@param [y] {number} y-coordinate of curve end (omitted if <code>x1</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	curveC: function(x1, y1, x2, y2, x, y, relative) {
		relative = ($.isArray(x1) ? y1 : relative);
		return this._coords((relative ? 'c' : 'C'), x1, y1, x2, y2, x, y);
	},

	/** Continue a cubic Bézier curve.
		<p>Starting control point is the reflection of the previous end control point.</p>
		@param x2 {number|number[][]} x-coordinate of ending control point or
				x-/y-coordinates of control and end points to draw to.
		@param [y2] {number} y-coordinate of ending control point (omitted if <code>x2</code> is array).
		@param [x] {number} x-coordinate of curve end (omitted if <code>x2</code> is array).
		@param [y] {number} y-coordinate of curve end (omitted if <code>x2</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	smoothC: function(x2, y2, x, y, relative) {
		relative = ($.isArray(x2) ? y2 : relative);
		return this._coords((relative ? 's' : 'S'), x2, y2, x, y);
	},

	/** Draw a quadratic Bézier curve.
		@param x1 {number|number[][]} x-coordinate of control point or
				x-/y-coordinates of control and end points to draw to.
		@param [y1] {number} y-coordinate of control point (omitted if <code>x1</code> is array).
		@param [x] {number} x-coordinate of curve end (omitted if <code>x1</code> is array).
		@param [y] {number} y-coordinate of curve end (omitted if <code>x1</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	curveQ: function(x1, y1, x, y, relative) {
		relative = ($.isArray(x1) ? y1 : relative);
		return this._coords((relative ? 'q' : 'Q'), x1, y1, x, y);
	},

	/** Continue a quadratic Bézier curve.
		<p>Control point is the reflection of the previous control point.</p>
		@param x {number|number[][]} x-coordinate of curve end or x-/y-coordinates of points to draw to.
		@param [y] {number} y-coordinate of curve end (omitted if <code>x</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	smoothQ: function(x, y, relative) {
		relative = ($.isArray(x) ? y : relative);
		return this._coords((relative ? 't' : 'T'), x, y);
	},

	/** Generate a path command with (a list of) coordinates.
		@private
		@param cmd {string} The command for the path element.
		@param x1 {number} The first x-coordinate.
		@param y1 {number} The first y-coordinate.
		@param [x2] {number} The second x-coordinate.
		@param [y2] {number} The second y-coordinate.
		@param [x3] {number} The third x-coordinate.
		@param [y3] {number} The third y-coordinate.
		@return {SVGPath} This path. */
	_coords: function(cmd, x1, y1, x2, y2, x3, y3) {
		if ($.isArray(x1)) {
			for (var i = 0; i < x1.length; i++) {
				var cs = x1[i];
				this._path += (i === 0 ? cmd : ' ') + cs[0] + ',' + cs[1] + (cs.length < 4 ? '' :
						' ' + cs[2] + ',' + cs[3] + (cs.length < 6 ? '': ' ' + cs[4] + ',' + cs[5]));
			}
		}
		else {
			this._path += cmd + x1 + ',' + y1 + 
				(x2 == null ? '' : ' ' + x2 + ',' + y2 + (x3 == null ? '' : ' ' + x3 + ',' + y3));
		}
		return this;
	},

	/** Draw an arc to a position.
		@param rx {number|any[][]} x-radius of arc or x-/y-coordinates and flags for points to draw to.
		@param [ry] {number} y-radius of arc (omitted if <code>rx</code> is array).
		@param [xRotate] {number} x-axis rotation (degrees, clockwise) (omitted if <code>rx</code> is array).
		@param [large] {boolean} <code>true</code> to draw the large part of the arc,
				<code>false</code> to draw the small part (omitted if <code>rx</code> is array).
		@param [clockwise] {boolean} <code>true</code> to draw the clockwise arc,
				<code>false</code> to draw the anti-clockwise arc (omitted if <code>rx</code> is array).
		@param [x] {number} x-coordinate of arc end (omitted if <code>rx</code> is array).
		@param [y] {number} y-coordinate of arc end (omitted if <code>rx</code> is array).
		@param [relative=false] {boolean} <code>true</code> for coordinates relative to the current point,
				<code>false</code> for coordinates being absolute.
		@return {SVGPath} This path. */
	arc: function(rx, ry, xRotate, large, clockwise, x, y, relative) {
		relative = ($.isArray(rx) ? ry : relative);
		this._path += (relative ? 'a' : 'A');
		if ($.isArray(rx)) {
			for (var i = 0; i < rx.length; i++) {
				var cs = rx[i];
				this._path += (i === 0 ? '' : ' ') + cs[0] + ',' + cs[1] + ' ' +
					cs[2] + ' ' + (cs[3] ? '1' : '0') + ',' + (cs[4] ? '1' : '0') + ' ' + cs[5] + ',' + cs[6];
			}
		}
		else {
			this._path += rx + ',' + ry + ' ' + xRotate + ' ' +
				(large ? '1' : '0') + ',' + (clockwise ? '1' : '0') + ' ' + x + ',' + y;
		}
		return this;
	},

	/** Close the current path.
		@return {SVGPath} This path. */
	close: function() {
		this._path += 'z';
		return this;
	},

	/** Return the string rendering of the specified path.
		@return {string} The stringified path. */
	path: function() {
		return this._path;
	}
});

SVGPath.prototype.moveTo = SVGPath.prototype.move;
SVGPath.prototype.lineTo = SVGPath.prototype.line;
SVGPath.prototype.horizTo = SVGPath.prototype.horiz;
SVGPath.prototype.vertTo = SVGPath.prototype.vert;
SVGPath.prototype.curveCTo = SVGPath.prototype.curveC;
SVGPath.prototype.smoothCTo = SVGPath.prototype.smoothC;
SVGPath.prototype.curveQTo = SVGPath.prototype.curveQ;
SVGPath.prototype.smoothQTo = SVGPath.prototype.smoothQ;
SVGPath.prototype.arcTo = SVGPath.prototype.arc;

/** Helper to generate an SVG text object.
	<p>Obtain an instance from the SVGWrapper object.</p>
	<p>String calls together to generate the text and use its value:</p>
	@module SVGText
	@example var text = root.createText();
   root.text(null, x, y, text.string('This is ').
     span('red', {fill: 'red'}).string('!'), {fill: 'blue'}); */
function SVGText() {
	this._parts = []; // The components of the text object
}

$.extend(SVGText.prototype, {
	/** Prepare to create a new text object.
		@return {SVGText} This text object. */
	reset: function() {
		this._parts = [];
		return this;
	},

	/** Add a straight string value.
		@param value {string} The actual text.
		@return {SVGText} This text object. */
	string: function(value) {
		this._parts.push(['text', value]);
		return this;
	},

	/** Add a separate text span that has its own settings.
		@param value {string} The actual text.
		@param settings {object} The settings for this text.
		@return {SVGText} This text object. */
	span: function(value, settings) {
		this._parts.push(['tspan', value, settings]);
		return this;
	},

	/** Add a reference to a previously defined text string.
		@param id {string} The ID of the actual text.
		@param settings {object} The settings for this text.
		@return {SVGText} This text object. */
	ref: function(id, settings) {
		this._parts.push(['tref', id, settings]);
		return this;
	},

	/** Add text drawn along a path.
		@param id {string} The ID of the path.
		@param value {string} The actual text.
		@param settings {object} The settings for this text.
		@return {SVGText} This text object. */
	path: function(id, value, settings) {
		this._parts.push(['textpath', value, $.extend({href: id}, settings || {})]);
		return this;
	}
});

/** Attach the SVG functionality to a jQuery selection.
	@param [command] {string} The command to run.
	@param [options] {object} The new settings to use for these SVG instances.
	@return {jQuery} For chaining further calls. */
$.fn.svg = function(options) {
	var otherArgs = Array.prototype.slice.call(arguments, 1);
	if (typeof options === 'string' && options === 'get') {
		return $.svg['_' + options + 'SVG'].apply($.svg, [this[0]].concat(otherArgs));
	}
	return this.each(function() {
		if (typeof options === 'string') {
			$.svg['_' + options + 'SVG'].apply($.svg, [this].concat(otherArgs));
		}
		else {
			$.svg._attachSVG(this, options || {});
		} 
	});
};

// Singleton primary SVG interface
$.svg = new SVGManager();

})(jQuery);

/**
sprintf() for JavaScript 0.7-beta1
http://www.diveintojavascript.com/projects/javascript-sprintf

Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of sprintf() for JavaScript nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


Changelog:
2010.09.06 - 0.7-beta1
  - features: vsprintf, support for named placeholders
  - enhancements: format cache, reduced global namespace pollution

2010.05.22 - 0.6:
 - reverted to 0.4 and fixed the bug regarding the sign of the number 0
 Note:
 Thanks to Raphael Pigulla <raph (at] n3rd [dot) org> (http://www.n3rd.org/)
 who warned me about a bug in 0.5, I discovered that the last update was
 a regress. I appologize for that.

2010.05.09 - 0.5:
 - bug fix: 0 is now preceeded with a + sign
 - bug fix: the sign was not at the right position on padded results (Kamal Abdali)
 - switched from GPL to BSD license

2007.10.21 - 0.4:
 - unit test and patch (David Baird)

2007.09.17 - 0.3:
 - bug fix: no longer throws exception on empty paramenters (Hans Pufal)

2007.09.11 - 0.2:
 - feature: added argument swapping

2007.04.03 - 0.1:
 - initial release
**/

var sprintf = (function() {
	function get_type(variable) {
		return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
	}
	function str_repeat(input, multiplier) {
		for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
		return output.join('');
	}

	var str_format = function() {
		if (!str_format.cache.hasOwnProperty(arguments[0])) {
			str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
		}
		return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
	};

	str_format.format = function(parse_tree, argv) {
		var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
		for (i = 0; i < tree_length; i++) {
			node_type = get_type(parse_tree[i]);
			if (node_type === 'string') {
				output.push(parse_tree[i]);
			}
			else if (node_type === 'array') {
				match = parse_tree[i]; // convenience purposes only
				if (match[2]) { // keyword argument
					arg = argv[cursor];
					for (k = 0; k < match[2].length; k++) {
						if (!arg.hasOwnProperty(match[2][k])) {
							throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
						}
						arg = arg[match[2][k]];
					}
				}
				else if (match[1]) { // positional argument (explicit)
					arg = argv[match[1]];
				}
				else { // positional argument (implicit)
					arg = argv[cursor++];
				}

				if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
					throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
				}
				switch (match[8]) {
					case 'b': arg = arg.toString(2); break;
					case 'c': arg = String.fromCharCode(arg); break;
					case 'd': arg = parseInt(arg, 10); break;
					case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
					case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
					case 'o': arg = arg.toString(8); break;
					case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
					case 'u': arg = Math.abs(arg); break;
					case 'x': arg = arg.toString(16); break;
					case 'X': arg = arg.toString(16).toUpperCase(); break;
				}
				arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
				pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
				pad_length = match[6] - String(arg).length;
				pad = match[6] ? str_repeat(pad_character, pad_length) : '';
				output.push(match[5] ? arg + pad : pad + arg);
			}
		}
		return output.join('');
	};

	str_format.cache = {};

	str_format.parse = function(fmt) {
		var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
		while (_fmt) {
			if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
				parse_tree.push(match[0]);
			}
			else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
				parse_tree.push('%');
			}
			else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
				if (match[2]) {
					arg_names |= 1;
					var field_list = [], replacement_field = match[2], field_match = [];
					if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
						field_list.push(field_match[1]);
						while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
							if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
								field_list.push(field_match[1]);
							}
							else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
								field_list.push(field_match[1]);
							}
							else {
								throw('[sprintf] huh?');
							}
						}
					}
					else {
						throw('[sprintf] huh?');
					}
					match[2] = field_list;
				}
				else {
					arg_names |= 2;
				}
				if (arg_names === 3) {
					throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
				}
				parse_tree.push(match);
			}
			else {
				throw('[sprintf] huh?');
			}
			_fmt = _fmt.substring(match[0].length);
		}
		return parse_tree;
	};

	return str_format;
})();

var vsprintf = function(fmt, argv) {
	argv.unshift(fmt);
	return sprintf.apply(null, argv);
};
