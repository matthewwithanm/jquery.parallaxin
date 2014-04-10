/*jslint browser: true, nomen: true, todo: true */
(function ($, window, document) {
    'use strict';

    var P, Parallaxin, px, pct;

    px = function (n) { return {value: n, px: true}; };
    pct = function (n) { return {value: n, pct: true}; };

    P = Parallaxin = function () {};
    Parallaxin.instances = [];

    P.PositionMethod = {
        ELEMENT_POSITION: function ($el, left, top) {
          $el.css({left: left, top: top});
        },
        CSS_TRANSLATE: function ($el, left, top) {
            var value = '';
            if (left != null) {
                value += 'translateX(' + left + 'px)';
            }
            if (top != null) {
                value += ' translateY(' + top + 'px)';
            }
            if (value) {
                $el.css('transform', value);
            }
        }
    };

    Parallaxin.prototype = {
        optionAttributePrefix: 'data-parallaxin-',

        defaultOptions: {
            // The container element. Defaults to the parent of the selected element.
            container: null,

            // Should the element move vertically?
            vertical: true,

            // Should the element move horizontally?
            horizontal: false,

            // Does the container change sizes?
            responsive: false,

            // The element whose scrolling should change the position.
            scrollingElement: 'window',

            // How is the position set? This can be either a function or a
            // string that correspondes to one of the built-in functions.
            positionMethod: P.PositionMethod.CSS_TRANSLATE,

            // Should the element use fixed positioning? The default value
            // depends on whether the element is styles as "position: fixed"
            // at the time the plugin is initialized, so normally you shouldn't
            // need to set this option; just set "position: fixed" in your
            // stylesheet.
            //
            // Using fixed positioning means the element is positioned relative
            // to the document instead of its parent and can result in a much
            // smoother parallax effect.
            fixed: null,

            // Should the element be hidden when its container leaves the
            // viewport? This helps to eliminate z-index issues when using fixed
            // positioning and multiple parallaxin elements.
            hideOnExit: true,

            // Contrain the range of motion within the container. Can be a
            // string or array, specified in the order "top", "right", "bottom",
            // "left." If less than four values are provided, they will be
            // expanded like with CSS. For example, the following are all
            // equivalent: `0`, `'0'`, `'0 0'`, `'0 0 0 0'` `[0]`, `[0, 0]`,
            // `[0, 0, 0, 0]`. Percentage values are also allowed.
            insets: 0
        },

        initialize: function ($el, options) {
            var isFixed;

            this.$el = $el;
            this.options = $.extend({}, this.defaultOptions, this.getHtmlOptions(), options);
            if (this.options.container) {
                this.$container = $(this.options.container);
            } else {
                this.$container = this.$el.parent();
            }
            this._insets = this.parseInsets(this.options.insets);

            isFixed = $el.css('position') === 'fixed';
            if (this.options.fixed === null || this.options.fixed === undefined) {
                this.options.fixed = isFixed;
            }
            if (this.options.fixed && !isFixed) {
                this.$el.css('position', 'fixed');
            }

            if (typeof this.options.positionMethod === 'string') {
                switch (this.options.positionMethod) {
                case 'elementPosition':
                    this.options.positionMethod = P.PositionMethod.ELEMENT_POSITION;
                    break;
                case 'cssTranslate':
                    this.options.positionMethod = P.PositionMethod.CSS_TRANSLATE;
                    break;
                default:
                    $.error('Invalid positionMethod value: ' + this.options.positionMethod)
                }
            }

            if (!P.$win) {
                P.$win = $(window);
            }

            // Add the listener to the scrolling element.
            this.$scrollingEl = this.options.scrollingElement ? $(this.options.scrollingElement) : P.$win;
            this._onScroll = $.proxy(this.onScroll, this);
            this.$scrollingEl.on('scroll', this._onScroll);

            if (!P._hasResizeHandler && this.options.responsive) {
                P._hasResizeHandler = true;
                P.$win.on('resize', P.onWindowResize);
            }

            P.instances.push(this);
            this.update(false);
            return this;
        },

        destroy: function () {
            var index = P.instances.indexOf(this);
            P.instances.splice(index, 1);
            this.$scrollingEl.off('scroll', this._onScroll);
            return this;
        },

        // Update the position of the element.
        update: function (r) {
            var self = this;
            if (requestAnimationFrame) {
                if (!this._afScheduled) {
                    this._afScheduled = true;
                    requestAnimationFrame(function () {
                        self.updateNow(r);
                        self._afScheduled = false;
                    });
                }
            } else {
                this.updateNow(r);
            }
        },

        updateNow: function (r) {
            var
                a, b, c,
                shouldHide,
                recalculate = r !== false,
                recalculateContainerSize = recalculate,
                recalculateSize = recalculate,
                // TODO: Performance could be improved if there could be an option for setting this to false and a way to do it manually. (Gotta figure out a good name for the option.)
                recalculateContainerPosition = true,
                bounds = this._bounds,
                size = this._size,
                containerSize = this._containerSize,
                containerPosition = this._containerPosition,
                scrollPosition = this.getScrollPosition(),
                windowSize = P.getWindowSize(),
                css = {};

            if (recalculateContainerSize || !containerSize) {
                containerSize = this._containerSize = this.calculateElSize(this.$container);
                bounds = this._bounds = this.calculateBounds(this._insets, containerSize);
            }

            if (recalculateSize || !size) {
                size = this._size = this.calculateElSize(this.$el, this._isHidden);
            }

            if (recalculateContainerPosition || !containerPosition) {
                // Unlike sizes, jQuery calculates both vertical and horizontal
                // positions with one measurement, so we can't do them
                // separately.

                // Determine the position of the element relative to the top of
                // the scrolling element's contents. We need to make sure we
                // account for both the normal case (scrolling the document) and
                // for scrolling of arbitrary (overflown) elements.
                a = this.$container.offset();
                b = {left: this.$scrollingEl.scrollLeft(), top: this.$scrollingEl.scrollTop()};
                c = {left: P.$win.scrollLeft(), top: P.$win.scrollTop()};
                containerPosition = this._containerPosition = {
                  left: a.left + b.left - c.left,
                  top: a.top + b.top - c.top
                }
            }

            if (this.options.horizontal) {
                css.left = this.updatePosition(bounds.L, bounds.R,
                    containerPosition.left, containerSize.width, size.width,
                    scrollPosition.left, windowSize.width);
            }
            if (this.options.vertical) {
                css.top = this.updatePosition(bounds.T, bounds.B,
                    containerPosition.top, containerSize.height, size.height,
                    scrollPosition.top, windowSize.height);
            }

            if (this.options.hideOnExit) {
                shouldHide = (!this.options.horizontal || css.left === undefined) &&
                    (!this.options.vertical || css.top === undefined);
                if (shouldHide !== !!this._isHidden) {
                    this.$el[shouldHide ? 'hide' : 'show']();
                    this._isHidden = shouldHide;
                }
            }
            if (css.left !== undefined || css.top !== undefined) {
                this.options.positionMethod(this.$el, css.left, css.top);
            }
        },

        updatePosition: function (boundsMin, boundsMax, containerPosition, containerSize, elSize, scrollPosition, windowSize) {
            // When the container is at the top of the viewport (min scrollTop),
            // $el should be aligned to its top. When the container is at the
            // bottom of the viewport (max scrollTop), $el should be aligned to
            // the bottom.
            var min, max, pct, targetMin, targetMax, pos;

            if (containerPosition + containerSize < scrollPosition) {
                // Container is above viewport.
                return undefined;
            }
            if (containerPosition > scrollPosition + windowSize) {
                // Container is below viewport.
                return undefined;
            }

            if (elSize <= windowSize) {
                max = containerPosition;
                min = containerPosition + containerSize - windowSize;
                targetMin = boundsMax - elSize;
                targetMax = boundsMin;
            } else {
                min = containerPosition - windowSize;
                max = containerPosition + containerSize;
                targetMin = boundsMin - elSize;
                targetMax = boundsMax;
            }

            pct = (scrollPosition - min) / (max - min);
            pos = targetMin + pct * (targetMax - targetMin);

            if (this.options.fixed) {
                // Make the positioin relative to the document instead of the
                // container.
                pos += containerPosition - scrollPosition;
            }

            return pos;
        },

        calculateElSize: function ($el, isHidden) {
            var size = {};
            if (isHidden) {
                $el.show();
            }
            if (this.options.horizontal) {
                size.width = $el.outerWidth();
            }
            if (this.options.vertical) {
                size.height = $el.outerHeight();
            }
            if (isHidden) {
                $el.hide();
            }
            return size;
        },

        calculateBound: function (inset, size, fromOpposite) {
            if (inset.pct) {
                return this.calculateBound(px(inset.value * size), size, fromOpposite);
            }
            if (fromOpposite) {
                return size - inset.value;
            }
            return inset.value;
        },

        // Convert parsed insets into actual pixel positions based on the size
        // of the container.
        calculateBounds: function (insets, containerSize) {
            var bounds = {};
            if (this.options.horizontal) {
                bounds.R = this.calculateBound(insets.R, containerSize.width);
                bounds.L = this.calculateBound(insets.L, containerSize.width, true);
            }
            if (this.options.vertical) {
                bounds.T = this.calculateBound(insets.T, containerSize.height);
                bounds.B = this.calculateBound(insets.B, containerSize.height, true);
            }
            return bounds;
        },

        parseInset: function (val) {
            switch ($.type(val)) {
            case 'number':
                return px(val);
            case 'string':
                if (val.indexOf('%') > -1) {
                    return pct(parseFloat(val) / 100);
                }
                return px(parseInt(val, 10));
            }
        },

        // Parse inset options into numbers and units corresponding to each
        // side.
        parseInsets: function (val) {
            var parsed, a, v, h, t, r, b, l;

            switch ($.type(val)) {
            case 'number':
                return {T: px(val), R: px(val), B: px(val), L: px(val)};
            case 'array':
                switch (val.length) {
                case 1:
                    a = this.parseInset(val[0]);
                    return {T: a, R: a, B: a, L: a};
                case 2:
                    v = this.parseInset(val[0]);
                    h = this.parseInset(val[1]);
                    return {T: v, R: h, B: v, L: h};
                case 4:
                    t = this.parseInset(val[0]);
                    r = this.parseInset(val[1]);
                    b = this.parseInset(val[2]);
                    l = this.parseInset(val[4]);
                    return {T: t, R: r, B: b, L: l};
                }
                break;
            case 'string':
                return this.parseInsets(val.replace(/^\s+|\s+$/, '').split(/\s+/));
            }
        },

        getHtmlOptions: function () {
            var self = this,
                opts = {};
            $.each(this.$el[0].attributes, function (i, attr) {
                if (attr.name.indexOf(self.optionAttributePrefix) !== -1) {
                    opts[attr.name.substr(self.optionAttributePrefix.length)] = attr.value;
                }
            });
            return opts;
        },

        onScroll: function () {
            // TODO: We really want to not get the position multiple times for the same element.
            var
                oldPos = this._scrollPosition,
                pos = this.getScrollPosition(true),
                topChanged = !oldPos || oldPos.top !== pos.top,
                leftChanged = !oldPos || oldPos.top !== pos.top;

            if ((topChanged && this.options.vertical) || (leftChanged && this.options.horizontal)) {
                this.update(false);
            }
        },

        getScrollPosition: function (recalculate) {
            if (recalculate || !this._scrollPosition) {
                this._scrollPosition = {
                    top: this.$scrollingEl.scrollTop(),
                    left: this.$scrollingEl.scrollLeft()
                };
            }
            return this._scrollPosition;
        }
    };

    Parallaxin.getWindowSize = function (recalculate) {
        if (recalculate || !P._windowSize) {
            P._windowSize = {
                width: P.$win.width(),
                height: P.$win.height()
            };
        }
        return P._windowSize;
    };

    Parallaxin.onWindowResize = function () {
        var i, instance;
        P.getWindowSize(true);
        for (i = P.instances.length - 1; i >= 0; i -= 1) {
            instance = P.instances[i];
            if (instance.options.responsive) {
                instance.update();
            }
        }
    };


    $.extend($.fn, {
        parallaxin: function (optionsOrMethod) {
            var returnValue = this,
                args = arguments;
            this.each(function (i, el) {
                var $el = $(el),
                    plugin = $el.data('parallaxin'),
                    method = typeof optionsOrMethod === 'string' ? optionsOrMethod : null,
                    options = method === null ? optionsOrMethod || {} : {};

                if (!plugin) {
                    if (method) {
                        $.error('You can\'t call the parallaxin method "' + method
                                + '" without first initializing the plugin by calling '
                                + 'parallaxin() on the jQuery object.');
                    } else {
                        plugin = new Parallaxin().initialize($el, options);
                        $el.data('parallaxin', plugin);
                    }
                } else if (method) {
                    if (typeof plugin[method] !== 'function') {
                        $.error('Method "' + method + '" does not exist on jQuery.parallaxin');
                    } else {
                        // NOTE: If you call a method that returns a value, you will only get the result from the last item in the collection.
                        returnValue = plugin[method].apply(plugin, Array.prototype.slice.call(args, 1));
                    }
                }
            });
            return returnValue;
        }
    });
}(this.jQuery, window, document));
