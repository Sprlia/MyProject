
(function ($) {                //浏览器兼容mousewheel
    var toFix  = ['wheel', 'mousewheel', 'DOMMouseScroll', 'MozMousePixelScroll'],
        toBind = ( 'onwheel' in document || document.documentMode >= 9 ) ?
                    ['wheel'] : ['mousewheel', 'DomMouseScroll', 'MozMousePixelScroll'],
        slice  = Array.prototype.slice,
        nullLowestDeltaTimeout, lowestDelta;

    if ( $.event.fixHooks ) {
        for ( var i = toFix.length; i; ) {
            $.event.fixHooks[ toFix[--i] ] = $.event.mouseHooks;
        }
    }

    var special = $.event.special.mousewheel = {
        version: '3.1.12',

        setup: function() {
            if ( this.addEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.addEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = handler;
            }
            // Store the line height and page height for this particular element
            $.data(this, 'mousewheel-line-height', special.getLineHeight(this));
            $.data(this, 'mousewheel-page-height', special.getPageHeight(this));
        },

        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.removeEventListener( toBind[--i], handler, false );
                }
            } else {
                this.onmousewheel = null;
            }
            // Clean up the data we added to the element
            $.removeData(this, 'mousewheel-line-height');
            $.removeData(this, 'mousewheel-page-height');
        },

        getLineHeight: function(elem) {
            var $elem = $(elem),
                $parent = $elem['offsetParent' in $.fn ? 'offsetParent' : 'parent']();
            if (!$parent.length) {
                $parent = $('body');
            }
            return parseInt($parent.css('fontSize'), 10) || parseInt($elem.css('fontSize'), 10) || 16;
        },

        getPageHeight: function(elem) {
            return $(elem).height();
        },

        settings: {
            adjustOldDeltas: true, // see shouldAdjustOldDeltas() below
            normalizeOffset: true  // calls getBoundingClientRect for each event
        }
    };

    $.fn.extend({
        mousewheel: function(fn) {
            return fn ? this.bind('mousewheel', fn) : this.trigger('mousewheel');
        },

        unmousewheel: function(fn) {
            return this.unbind('mousewheel', fn);
        }
    });


    function handler(event) {
        var orgEvent   = event || window.event,
            args       = slice.call(arguments, 1),
            delta      = 0,
            deltaX     = 0,
            deltaY     = 0,
            absDelta   = 0,
            offsetX    = 0,
            offsetY    = 0;
        event = $.event.fix(orgEvent);
        event.type = 'mousewheel';

        // Old school scrollwheel delta
        if ( 'detail'      in orgEvent ) { deltaY = orgEvent.detail * -1;      }
        if ( 'wheelDelta'  in orgEvent ) { deltaY = orgEvent.wheelDelta;       }
        if ( 'wheelDeltaY' in orgEvent ) { deltaY = orgEvent.wheelDeltaY;      }
        if ( 'wheelDeltaX' in orgEvent ) { deltaX = orgEvent.wheelDeltaX * -1; }

        // Firefox < 17 horizontal scrolling related to DOMMouseScroll event
        if ( 'axis' in orgEvent && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
            deltaX = deltaY * -1;
            deltaY = 0;
        }

        // Set delta to be deltaY or deltaX if deltaY is 0 for backwards compatabilitiy
        delta = deltaY === 0 ? deltaX : deltaY;

        // New school wheel delta (wheel event)
        if ( 'deltaY' in orgEvent ) {
            deltaY = orgEvent.deltaY * -1;
            delta  = deltaY;
        }
        if ( 'deltaX' in orgEvent ) {
            deltaX = orgEvent.deltaX;
            if ( deltaY === 0 ) { delta  = deltaX * -1; }
        }

        // No change actually happened, no reason to go any further
        if ( deltaY === 0 && deltaX === 0 ) { return; }

        // Need to convert lines and pages to pixels if we aren't already in pixels
        // There are three delta modes:
        //   * deltaMode 0 is by pixels, nothing to do
        //   * deltaMode 1 is by lines
        //   * deltaMode 2 is by pages
        if ( orgEvent.deltaMode === 1 ) {
            var lineHeight = $.data(this, 'mousewheel-line-height');
            delta  *= lineHeight;
            deltaY *= lineHeight;
            deltaX *= lineHeight;
        } else if ( orgEvent.deltaMode === 2 ) {
            var pageHeight = $.data(this, 'mousewheel-page-height');
            delta  *= pageHeight;
            deltaY *= pageHeight;
            deltaX *= pageHeight;
        }

        // Store lowest absolute delta to normalize the delta values
        absDelta = Math.max( Math.abs(deltaY), Math.abs(deltaX) );

        if ( !lowestDelta || absDelta < lowestDelta ) {
            lowestDelta = absDelta;

            // Adjust older deltas if necessary
            if ( shouldAdjustOldDeltas(orgEvent, absDelta) ) {
                lowestDelta /= 40;
            }
        }

        // Adjust older deltas if necessary
        if ( shouldAdjustOldDeltas(orgEvent, absDelta) ) {
            // Divide all the things by 40!
            delta  /= 40;
            deltaX /= 40;
            deltaY /= 40;
        }

        // Get a whole, normalized value for the deltas
        delta  = Math[ delta  >= 1 ? 'floor' : 'ceil' ](delta  / lowestDelta);
        deltaX = Math[ deltaX >= 1 ? 'floor' : 'ceil' ](deltaX / lowestDelta);
        deltaY = Math[ deltaY >= 1 ? 'floor' : 'ceil' ](deltaY / lowestDelta);

        // Normalise offsetX and offsetY properties
        if ( special.settings.normalizeOffset && this.getBoundingClientRect ) {
            var boundingRect = this.getBoundingClientRect();
            offsetX = event.clientX - boundingRect.left;
            offsetY = event.clientY - boundingRect.top;
        }
        // Add information to the event object
        event.deltaX = deltaX;
        event.deltaY = deltaY;
        event.deltaFactor = lowestDelta;
        event.offsetX = offsetX;
        event.offsetY = offsetY;
        // Go ahead and set deltaMode to 0 since we converted to pixels
        // Although this is a little odd since we overwrite the deltaX/Y
        // properties with normalized deltas.
        event.deltaMode = 0;

        // Add event and delta to the front of the arguments
        args.unshift(event, delta, deltaX, deltaY);

        // Clearout lowestDelta after sometime to better
        // handle multiple device types that give different
        // a different lowestDelta
        // Ex: trackpad = 3 and mouse wheel = 120
        if (nullLowestDeltaTimeout) { clearTimeout(nullLowestDeltaTimeout); }
        nullLowestDeltaTimeout = setTimeout(nullLowestDelta, 200);

        return ($.event.dispatch || $.event.handle).apply(this, args);
    }

    function nullLowestDelta() {
        lowestDelta = null;
    }

    function shouldAdjustOldDeltas(orgEvent, absDelta) {
        // If this is an older event and the delta is divisable by 120,
        // then we are assuming that the browser is treating this as an
        // older mouse wheel event and that we should divide the deltas
        // by 40 to try and get a more usable deltaFactor.
        // Side note, this actually impacts the reported scroll distance
        // in older browsers and can cause scrolling to be slower than native.
        // Turn this off by setting $.event.special.mousewheel.settings.adjustOldDeltas to false.
        return special.settings.adjustOldDeltas && orgEvent.type === 'mousewheel' && absDelta % 120 === 0;
    }

})(jQuery);

(function ($) {                //设备兼容
    var toBind = ['touchstart','touchmove','touchend'],
        odeltaX = 0,
        odeltaY = 0,
        slice  = Array.prototype.slice;
    var special = $.event.special.touchmove = {
        version: '1.0.0',

        setup: function() {
            if ( this.addEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.addEventListener( toBind[--i], handler, false );
                }
            } else {
            }
        },

        teardown: function() {
            if ( this.removeEventListener ) {
                for ( var i = toBind.length; i; ) {
                    this.removeEventListener( toBind[--i], handler, false );
                }
            } else {
            }
        },

    };

    $.fn.extend({
        touchmove: function(fn) {
            return fn ? this.bind('touchmove', fn) : this.trigger('touchmove');
        },

        untouchmove: function(fn) {
            return this.unbind('touchmove', fn);
        }
    });


    function handler(event) {
        var orgEvent   = event || window.event,
            args       = slice.call(arguments, 1),
            deltaX     = 0,
            deltaY     = 0;
        event = $.event.fix(orgEvent);

        if(orgEvent.touches.length != 1){ return;};

        if(event.type == 'touchmove'){
            deltaX = orgEvent.touches[0].clientX - odeltaX;
            deltaY = orgEvent.touches[0].clientY - odeltaY;
        }
        event.deltaX = deltaX;
        event.deltaY = deltaY;
        odeltaX = orgEvent.touches[0].clientX;
        odeltaY = orgEvent.touches[0].clientY;
        args.unshift(event, deltaX, deltaY);
        return ($.event.dispatch || $.event.handle).apply(this,args);

    }
})(jQuery);





(function($){
    var myscroll = "myscroll";
    var scrollindex = 0,auto_updata_size;

    $.fn.scrollbar = function(){
        var method = arguments[0];

        if(methods[method]){
            method = methods[method];
            arguments = Array.prototype.slice.call(arguments,1);
        }else if( typeof(method)=='object' || !method ){
            method = methods.init;
        }else{
            $.error('method'+method+'does not exist');
            return this;
        }
        return method.apply(this,arguments);
    };

    var methods = {                                       //方法

        init:function(options){

            var options=$.extend(true,{},defaults,options);


            options.scrollInertia=options.scrollInertia>0 && options.scrollInertia<17 ? 17 : options.scrollInertia;
            return $(this).each(function(){
                var _this=this;
                $(this).css("overflow","hidden");
                if(!$(this).data(myscroll)){
                    $(this).data(myscroll,{
                        index:++scrollindex,
                        opt:options,
                        scrollratio:{x:null,y:null},
                        overflowed:null,
                        poll:{change:{o:0,n:0}}
                    });
                    makescrollbar.call(this);    //添加xy滚动轴
                    bindevents.call(this);        //绑定事件：鼠标滚动、触摸滚动、拖动
                    //if(auto_updata_size)    clearInterval(auto_updata_size);
                    auto_updata_size = setInterval(function(){
                        var d = $(_this).data(myscroll),o=d.opt;
                        var h = _this.clientHeight;
                        var h1 = _this.scrollHeight;
                        var w = _this.clientWidth;
                        var w1 = _this.scrollWidth;
                        if(h==h1 || h/h1 >= 1 ){
                            $(_this).siblings(".scrollbar_y").hide();
                        }else{
                            $(_this).siblings(".scrollbar_y").show();
                        };
                        if(w/w1 >= 1){
                            $(_this).siblings(".scrollbar_x").hide();
                        }else{
                            $(_this).siblings(".scrollbar_x").show();
                        };
                        $(_this).siblings(".scrollbar_y").children(".scroll_dragger").css("height",h/h1*100+"%");
                        $(_this).siblings(".scrollbar_x").children(".scroll_dragger").css("width",w/w1*100+"%");
                        methods.position.call(_this);
                    },1500);
                };
            });
        },

        position:function(){             //以目标区域定位滚动条
                if($(this).data(myscroll)){
                    var i = $(this).data(myscroll).index;

                    var h1 = this.scrollTop;
                    var h = $("#ms_"+i+" .scroller")[0].scrollHeight;
                    var percent = h1/h;
                    var h2 = $("#ms_"+i+" .scrollbar_y").height();
                    $("#ms_"+i+" .scrollbar_y .scroll_dragger").css("margin-top",h1/h*h2+"px");

                    var h1 = this.scrollLeft;
                    var h = $("#ms_"+i+" .scroller")[0].scrollWidth;
                    var percent = h1/h;
                    var h2 = $("#ms_"+i+" .scrollbar_x").width();
                    $("#ms_"+i+" .scrollbar_x .scroll_dragger").css("margin-left",h1/h*h2+"px");
                }
        },

    };

    var defaults = {
        setTop:0,
        setLeft:0,
        axis:"xy",
        scrollbarPosition:"inside",
        scrollInertia:950,
        mouseWheel:{
            enable:true,
            axis:"y",
        },
        bind:{
            mouseWheel:false,
            touch:false,
            scrollbarmv:false,
        },

        callbacks:{
        }
    };

    var makescrollbar = function(){
        var d = $(this).data(myscroll),o = d.opt;
        var scrollbar="<div id='scrollbar_x_"+d.index+"' class='scrollbar_x'><div class='scroll_dragger'></div></div><div id='scrollbar_y_"+d.index+"' class='scrollbar_y'><div class='scroll_dragger'></div></div><div class='clearfix'></div>";
        $(this).wrap("<div id='ms_"+d.index+"' class='scroll_area'></div>");
        $("#ms_"+d.index).append(scrollbar);

        },

        bindevents = function(){
            var d = $(this).data(myscroll),o = d.opt,_this = this;
                $(this).bind('mousewheel', function(event) {                //绑定鼠标滚动
                    if((this.scrollTop+this.clientHeight) < this.scrollHeight && ((this.scrollTop == 0 && event.deltaY<0)||this.scrollTop != 0)){
                        if(this==event.currentTarget){
                            event.preventDefault();
                            var scrollTop = this.scrollTop;
                            this.scrollTop = (scrollTop + ((event.deltaY * event.deltaFactor) * -1));
                            methods.position.call(this);
                        }
                    }
                    if((this.scrollTop+this.clientHeight) == this.scrollHeight && event.deltaY > 0){
                        if(this==event.currentTarget){
                            event.preventDefault();
                            var scrollTop = this.scrollTop;
                            this.scrollTop = (scrollTop + ((event.deltaY * event.deltaFactor) * -1));
                            methods.position.call(this);
                        }
                    }
                });
                d.opt.bind.mouseWheel = true;
    
                $(this).bind('touchmove',function(event) {               //绑定触摸滚动
                    if((this.scrollTop+this.clientHeight) < this.scrollHeight && ((this.scrollTop == 0 && event.deltaY<0)||this.scrollTop != 0)){
                        if(this==event.currentTarget){
                            event.preventDefault();
                            var scrollTop = this.scrollTop;
                            this.scrollTop = (scrollTop - event.deltaY);
                            this.scrollLeft = (this.scrollLeft - event.deltaX);
                            methods.position.call(this);
                        }
                    }
                    if((this.scrollTop+this.clientHeight) == this.scrollHeight && event.deltaY > 0){
                        if(this==event.currentTarget){
                            event.preventDefault();
                            var scrollTop = this.scrollTop;
                            this.scrollTop = (scrollTop - event.deltaY);
                            this.scrollLeft = (this.scrollLeft - event.deltaX);
                            methods.position.call(this);
                        }
                    }
                });
                d.opt.bind.touch = true;

		        $(this).siblings(".scrollbar_y").click(function(event){
                    event.preventDefault();
                    var posY = event.offsetY;
                    var target = this.clientHeight;
                    var value = posY / target;
                    _this.scrollTop = (0 + value*_this.scrollHeight);
                    methods.position.call(_this);
	    	    });

		        $(this).siblings(".scrollbar_x").click(function(event){
                    event.preventDefault();
                    var posX = event.offsetX;
                    var target = this.clientWidth;
                    var value = posX / target;
                    _this.scrollLeft = (0 + value*_this.scrollHeight);
                    methods.position.call(_this);
	    	    });

    		    $(this).siblings(".scrollbar_y").children(".scroll_dragger").eq(0).mousedown(function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var target = $(this).parent()[0].clientHeight;
                    var scrollTop = _this.scrollTop;
                    var scrollHeight = _this.scrollHeight;
	    	    	var origY = event.clientY;
    	    		$(document).mousemove(doDrag = function(event){
	    	    		event.preventDefault();
    			    	var moveY = event.clientY - origY;
                        var percent = moveY/target;
                        _this.scrollTop = (scrollTop+scrollHeight*percent);
                        methods.position.call(_this);
    		    	});
    	    		$(document).mouseup(stopDrag = function(){
	    	    		$(document).unbind("mousemove",doDrag);
		    	    	$(document).unbind("mouseup",stopDrag);
    		    	});
    	    	});

    		    $(this).siblings(".scrollbar_x").children(".scroll_dragger").eq(0).mousedown(function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    var target = $(this).parent()[0].clientWidth;  //滚动轴宽度
                    var scrollLeft = _this.scrollLeft;                  //目标区域左距
                    var scrollWidth = _this.scrollWidth;         //目标区域实际宽度
	    	    	var origX = event.clientX;                //鼠标位置
    	    		$(document).mousemove(doDrag = function(event){
	    	    		event.preventDefault();
    			    	var moveX = event.clientX - origX;       //鼠标偏移
                        var percent = moveX/target;
                        _this.scrollLeft = (scrollLeft+scrollWidth*percent);      //移动目标区域
                        methods.position.call(_this);
    		    	});
    	    		$(document).mouseup(stopDrag = function(){
	    	    		$(document).unbind("mousemove",doDrag);
		    	    	$(document).unbind("mouseup",stopDrag);
    		    	});
    	    	});
        }
})(jQuery);

