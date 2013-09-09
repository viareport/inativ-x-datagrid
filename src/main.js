require('inativ-x-inputfilter');

(function () {
    /* Methods ou on a juste un wrapper (x-datagrid) autour d'une table */
    /* Les perfs sont meilleurs qu'avec l'autre technique, mais il faudrait quand même utiliser la technique de w2ui */
    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    xtag.register('x-datagrid', {
        lifecycle: {
            created: function created() {
                this.contentWrapper = document.createElement('div');
                this.contentWrapper.setAttribute('class', 'contentWrapper scrollable-table-wrapper');
                this.columnHeaderWrapper = document.createElement('div');
                this.columnHeaderWrapper.setAttribute('class', 'columnHeaderWrapper');
                this.rowHeight = getTrHeight();
                var contentWrapperHeight = getContentWrapperHeight();
                this._nbRowDisplay = Math.floor(contentWrapperHeight / this.rowHeight);
                this.contentWrapper.style.height = ''+contentWrapperHeight+"px";
                this.appendChild(this.columnHeaderWrapper);
                this.appendChild(this.contentWrapper);
                this._scrollTop = 0;
                this._filters = [];
                this.lastCurrentRow = 0;
                this.cachedRow = this._nbRowDisplay * 2;
                this.scrollBarWidth = getScrollBarWidth();
            },
            inserted: function inserted() {
                var grid = this;
                window.onresize = function (e) {
                    if (!grid._isResizing && grid.columnHeaderWrapper.style.width !== '100%') {
                        grid._isResizing = true;
                        setTimeout(function () {
                            grid.updateIfScrollBar(grid.displayedData.length);
                            grid._isResizing = false;
                        }, 500);
                    }
                };
            },
            removed: function removed() {
            },
            attributeChanged: function attributedChanged() {
            }
        },
        events: {
            contentUpdated: function contentUpdated() {
                this._displayedData = null;
                this.renderContent(0);
            },
            headerUpdated: function headerUpdated() {
                this.renderHeaders(this.data);
            },
            click: function (elem) {
                //this.render(this.sort(elem.target.parentNode.cellIndex), this.calculateCurrentLine());
            },
            scroll: function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.target === this.contentWrapper) {
                    //this._scrollTop = Number(e.target.scrollTop);
                    var currentRow = this.calculateCurrentLine(Number(e.target.scrollTop));

                    var diffBetweenLastCurrentRow = Math.abs(currentRow - this.lastCurrentRow);
                    if (diffBetweenLastCurrentRow > this._nbRowDisplay) {
                        this.lastCurrentRow = currentRow;
                        this.renderContent(currentRow);
                    }
                }
            },
            filter: function (e) {
                this._displayedData = null;
                this.lastCurrentRow = 0;
                if (e.detail.filterValue === undefined || e.detail.filterValue === "") {
                    delete this._filters[e.detail.column];
                } else {
                    this._filters[e.detail.column] = e.detail.filterValue;
                }
                this.renderContent(0);
            }
        },
        accessors: {
            data: {
                set: function (data) {
                    this._data = {};
                    this.header = data.colHeader;
                    this.content = data.content;
                },
                get: function () {
                    return this._data;
                }
            },
            header: {
                set: function (header) {
                    this._data.colHeader = header;
                    var event = new CustomEvent('headerUpdated');
                    this.dispatchEvent(event);
                },
                get: function () {
                    return this._data.colHeader;
                }
            },
            content: {
                set: function (content) {
                    this._data.content = []; // Okazou on viendrait du setData
                    this._nbRow = content.length;

                    for (var i = 0; i < content.length; i++) {
                        this._data.content.push({
                            originIndex: i,
                            rowValue: content[i]
                        });
                    }
                    var event = new CustomEvent('contentUpdated');
                    this.dispatchEvent(event);
                },
                get: function () {
                    return this._data.content;
                }
            },
            displayedData: {
                get: function () {
                    if (!this._displayedData) {
                        var filteredData = this._data.content;

                        this._filters.forEach(function (filter, columnIndex) {
                            filteredData = this.applyFilter(filter, columnIndex, filteredData);
                        }, this);

                        this._displayedData = filteredData;
                    }

                    return this._displayedData;
                }
            }

        },
        methods: {
            render: function render(data, firstDisplay) {
                firstDisplay = firstDisplay || 0;
                var displayData = data || this._data;
                this.renderHeaders(displayData);
                this.renderContent(firstDisplay);
            },
            renderHeaders: function renderHeaders(data) {
                var tableColHeader = document.createElement("table");

                if (!data) {
                    return;
                }
                for (var j = 0; j < data.colHeader.length; j++) {
                    var trHeader = document.createElement("tr");
                    var colHeader;
                    for (var i = 0; i < data.colHeader[j].length; i++) {
                        colHeader = data.colHeader[j][i];
                        var tdHeader = this.renderHeader(colHeader, i);
                        trHeader.appendChild(tdHeader);
                    }
                    tableColHeader.appendChild(trHeader);
                }
                this.columnHeaderWrapper.innerHTML = '';
                this.columnHeaderWrapper.appendChild(tableColHeader);
            },
            renderHeader: function renderHeader(colHeader, coldIdx) {
                var tdHeader = document.createElement("th");
                if (colHeader.class) {
                    tdHeader.className += ' ' + colHeader.class;
                }
                if (colHeader.element) {
                    tdHeader.appendChild(colHeader.element);
                } else {
                    tdHeader.setAttribute('class', 'sortable');
                    if (colHeader.rowspan) {
                        tdHeader.setAttribute('rowspan', colHeader.rowspan);
                    }
                    if (colHeader.class) {
                        tdHeader.setAttribute('class', tdHeader.getAttribute('class') + ' ' + colHeader.class);
                    }
                    tdHeader.innerHTML = "<div class='x-datagrid-cell'>" + colHeader.value + "</div>";
                    if (colHeader.filter) {
                        var filter = document.createElement('x-inputfilter');
                        if (colHeader.defaultFilter) {
                            filter.setAttribute('defaultFilter', colHeader.defaultFilter);
                            this._filters[coldIdx] = colHeader.defaultFilter;
                        }
                        filter.setAttribute('column', coldIdx);
                        tdHeader.appendChild(filter);
                    }
                }
                return tdHeader;
            },
            renderContent: function renderContent(currentRowDisplay) {
                var displayData = this.displayedData;
                var tableContent = document.createElement("table");
                tableContent.setAttribute('id', 'tableContent');
                var firstRowCreate = currentRowDisplay - this.cachedRow;
                var lastRowCreate = currentRowDisplay + this._nbRowDisplay + this.cachedRow;

                this.updateIfScrollBar(displayData.length);

                if (currentRowDisplay === 0) {
                    this.contentWrapper.scrollTop = 0;
                }

                if (firstRowCreate < 0) {
                    firstRowCreate = 0;
                }
                // Création de la première ligne qui doit simuler la taille de toutes les lignes présentes avant la ligne courante
                if (currentRowDisplay !== firstRowCreate) {
                    tableContent.appendChild(this.simulateMultiRow(firstRowCreate));
                }
                if (lastRowCreate > displayData.length) {
                    lastRowCreate = displayData.length;
                }


                var rowIndex = firstRowCreate;
                var fragment = document.createDocumentFragment();
                for (; rowIndex < lastRowCreate; rowIndex++) {
                    var tr = document.createElement("tr");
                    tr.setAttribute('class', 'x-datagrid-tr');
                    var columnIndex = 0;
                    for (; columnIndex < displayData[rowIndex].rowValue.length; columnIndex++) {
                        var td = document.createElement("td"),
                            cellData = displayData[rowIndex].rowValue[columnIndex];
                        td.setAttribute('class', 'x-datagrid-td');
                        if (cellData.events) {
                            this.bindCustomEvents(cellData.events, td);
                        }
                        //TODO : class pourrait etre un tableau
                        var cellClass = cellData.class || '';
                        td.innerHTML = "<div class='x-datagrid-cell " + cellClass + "'>" + (cellData.value || '') + "</div>";
                        tr.appendChild(td);
                    }
                    fragment.appendChild(tr);
                }
                tableContent.appendChild(fragment);
                // S'il y a plus de lignes que celles que l'on affiche
                if (lastRowCreate < displayData.length) {
                    var nbRowAfterCurrent = displayData.length - lastRowCreate;
                    tableContent.appendChild(this.simulateMultiRow(nbRowAfterCurrent));
                    //et on en profite pour enlever la taille du scroll sur le tableau des colonnes headers
                }
                this.contentWrapper.innerHTML = '';

                this.contentWrapper.appendChild(tableContent);
            },
            sort: function sortData(columnIndex) {
                if (!columnIndex) {
                    throw new Error('a pas le column index pour sorter la data');
                }
                var displayData = new Object(this._data);
                var sortedData = displayData.slice(0);
                sortedData.sort(function (a, b) {
                    return a[columnIndex] - b[columnIndex];
                });
                displayData = sortedData;
                return displayData;
            },
            calculateCurrentLine: function getDisplayFirstLine(scrollTop) {
                var currentLine = Math.round(scrollTop / this.rowHeight);
                return  currentLine;
            },
            applyFilter: function applyFilter(filter, columnIndex, data) {
                if (columnIndex === undefined) {
                    throw new Error('Empty column index');
                }

                var regExp = new RegExp('^' + escapeRegExp(filter), "i");

                return data.filter(function (row) {
                    var elem = row.rowValue[columnIndex].value;
                    return regExp.test(elem);
                });
            },
            simulateMultiRow: function (nbRow) {
                var tr = document.createElement("tr");
                tr.style.height = (nbRow * this.rowHeight) + 'px';
                return tr;
            },
            updateIfScrollBar: function updateIfScrollBar(nbSource) {
                this.columnHeaderWrapper.style.width = '100%';
                var columnHeaderWrapperWidth = (nbSource > this._nbRowDisplay) ? (this.columnHeaderWrapper.offsetWidth - this.scrollBarWidth) + 'px' : '100%';
                this.columnHeaderWrapper.style.width = columnHeaderWrapperWidth;
            },
            bindCustomEvents: function (eventsTab, element) {
                var events = eventsTab;
                var eventTypes = Object.keys(events);
                var that = this;
                eventTypes.forEach(function (eventType) {
                    var eventName = eventType;
                    var customEventName = events[eventName].event;
                    var data = events[eventName].data;

                    var customEvent = new CustomEvent(customEventName, {'detail': data, 'bubbles': true});
                    element.addEventListener(eventName, function () {
                        that.dispatchEvent(customEvent);
                    });
                });
            }
        }
    });

//Recuperation de la taille de la scrollbar selon le navigateur
    function getScrollBarWidth() {
        var inner = document.createElement('p');
        inner.style.width = "100%";
        inner.style.height = "200px";

        var outer = document.createElement('div');
        outer.style.position = "absolute";
        outer.style.top = "0px";
        outer.style.left = "0px";
        outer.style.visibility = "hidden";
        outer.style.width = "200px";
        outer.style.height = "150px";
        outer.style.overflow = "hidden";
        outer.appendChild(inner);

        document.body.appendChild(outer);
        var w1 = inner.offsetWidth;
        outer.style.overflow = 'scroll';
        var w2 = inner.offsetWidth;
        if (w1 == w2) {
            w2 = outer.clientWidth;
        }
        document.body.removeChild(outer);
        return (w1 - w2);
    }

    function getTrHeight() {
        var table = document.createElement("table");
        var tr = document.createElement("tr");
        tr.setAttribute('class', 'x-datagrid-tr');
        var td = document.createElement("td");
        td.setAttribute('class', 'x-datagrid-td');
        td.innerHTML = "<div class='x-datagrid-cell'>test</div>";
        tr.appendChild(td);
        table.appendChild(tr);
        document.body.appendChild(table);
        var trOffsetHeight = tr.offsetHeight;
        document.body.removeChild(table);
        return trOffsetHeight;
    }

    function getContentWrapperHeight() {
        var contentWrapper = document.createElement('div');
        contentWrapper.setAttribute('class', 'contentWrapper scrollable-table-wrapper');
        //TODO On devrait s'insérer dans le parent de la grille plutôt que le body (possible hauteurs différentes)
        document.body.appendChild(contentWrapper);
        var contentWrapperHeight = contentWrapper.offsetHeight;
        document.body.removeChild(contentWrapper);
        return contentWrapperHeight;
    }
})();
