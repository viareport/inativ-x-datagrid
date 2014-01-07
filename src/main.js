require('inativ-x-inputfilter');
(function () {
    // Structure manipulé par le content du datagrid
    //[
    //  {
    //      originIndex: integer,
    //      rowValue: [
    //          Cell,
    //          Cell
    //      ]
    //  },
    //  {originIndex: integer, rowValue: []}
    //]
    'use strict';
    /* Methods ou on a juste un wrapper (x-datagrid) autour d'une table */
    /* Les perfs sont meilleurs qu'avec l'autre technique, mais il faudrait quand même utiliser la technique de w2ui */

    xtag.register('x-datagrid', {
        lifecycle: {
            created: function created() {
                this.contentWrapper = document.createElement('div');
                this.contentWrapper.setAttribute('class', 'contentWrapper'); //FIXME no camel case
                this.tableContent = document.createElement("table");
                this.contentWrapper.appendChild(this.tableContent);
                this.columnHeaderWrapper = document.createElement('div');
                this.columnHeaderWrapper.setAttribute('class', 'columnHeaderWrapper'); //FIXME no camel case
                this.rowHeight = getTrHeight();
                this.appendChild(this.columnHeaderWrapper);
                this.appendChild(this.contentWrapper);
                this._filters = [];
                this.lastCurrentRow = 0;
                this.scrollBarWidth = getScrollBarWidth();
                this.tableMinWidth = 0;
                this.plugins = [];
                this.firstRowCreate = null;

                this.cellMinWidth = Number(this.getAttribute('cell-width') || 150);
                
            },
            inserted: function inserted() {
                var grid = this;
                this.originOnResize = window.onresize || function(){};
                window.onresize = function () {
                    grid.originOnResize();
                    grid.calculateContentSize();
                    grid.calculateHeaderWidth(grid.gridModel.getLength());
                    grid.plugins.forEach(function(plugin){
                        plugin.onResize();
                    });
                };
            },
            removed: function removed() {
                window.onresize = this.originOnResize;
            },
            attributeChanged: function attributedChanged() {
            }
        },
        events: {
            contentUpdated: function contentUpdated() {
                this.renderContent(this.lastCurrentRow);
            },
            headerUpdated: function headerUpdated() {
                this.calculateMinimumWidth(this.cellMinWidth);
                this.renderHeaders();
            },
            scroll: function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.target === this.contentWrapper) {
                    var currentRow = this.calculateCurrentLine(Number(e.target.scrollTop));

                    var diffBetweenLastCurrentRow = Math.abs(currentRow - this.lastCurrentRow);
                    if (diffBetweenLastCurrentRow > this._nbRowDisplay) {
                        this.lastCurrentRow = currentRow;
                        this.renderContent(currentRow);
                    }
                }
            }
        },
        accessors: {
            columnModel: {
                set: function (header) {
                    if (header.renderHeader && header.getColumns && header.getCell) {
                        this._columnModel = header;
                    } else if (typeof header.length !== 'undefined') {
                        this._columnModel = new DefaultColumnModel(header);
                    } else {
                        throw new Error("'columnModel' must be an array or an object implementing 'renderHeader()', 'getCell(row, col)' and 'getColumns()' methods");
                    }
                    this._columnModel.grid = this;
                    this.dispatchEvent(new CustomEvent('headerUpdated'));
                },
                get: function () {
                    return this._columnModel;
                }
            },
            gridModel: {
                set: function (content) {
                    if (content.getLength && content.getRow) {
                        this._gridModel = content;
                    } else if (typeof content.length !== 'undefined') {
                        this._gridModel = new DefaultDatagridModel(content);
                    } else {
                        throw new Error("'gridModel' must be an array or an object implementing 'getLength' and 'getRow(int)' methods");
                    }
                    this._gridModel.grid = this;
                    this.dispatchEvent(new CustomEvent('contentUpdated'));
                },
                get: function () {
                    return this._gridModel;
                }
            }
        },
        methods: {
            getColumns: function getColumns() {
                return this.columnModel.getColumns();
            },
            getCell: function getCell(row, column) {
                return this.columnModel.getCell(row, column);
            },
            getRow: function getRow(rowIndex) {
                return this.gridModel.getRow(rowIndex);
            },
            getLength: function getLength() {
                return this.gridModel.getLength();
            },
            getContent: function getContent() {
                var content = [];
                for (var i=0 ; i<this.getLength() ; i++) {
                    content.push(this.getRow(i));
                }
                return content;
            },
            registerPlugin: function register(plugin) {
                plugin.datagrid = this;
                plugin.append();
                this.plugins.push(plugin);
            },
            bindCellEvents: function bindCellEvents(td, cell, row, column) {
                var grid = this;
                if (cell.events) {
                    Object.keys(cell.events).forEach(function (eventType) {
                        td.addEventListener(eventType, function(domEvt) {
                            var customEvent = cell.events[eventType];
                            grid.dispatchEvent(new CustomEvent(customEvent.event, {
                                detail:  {
                                    td: domEvt.currentTarget,
                                    cell: cell,
                                    row: row,
                                    // rowIndex ?
                                    column: column,
                                    data: customEvent.data
                                },
                                bubbles: true
                            }));
                        });
                    });
                }
            },
            renderHeaders: function renderHeaders() {
                var table = document.createElement('table'),
                    tr = document.createElement('tr');
                table.appendChild(tr);
                this.columnModel.renderHeader(tr);
                this.columnHeaderWrapper.innerHTML = '';
                this.columnHeaderWrapper.appendChild(table);
                this.calculateContentSize();
            },
            renderContent: function renderContent(currentRowDisplay) {
                var length = this.gridModel.getLength(); //displayData = this.displayedData;
                var tableContentFragment = document.createElement('tbody');
                var lastRowCreate = Math.min(length, currentRowDisplay + this._nbRowDisplay + this.cachedRow);

                this.firstRowCreate = Math.max(0, currentRowDisplay - this.cachedRow);

                this.calculateHeaderWidth(length);

                var rowIndex = this.firstRowCreate;

                // Création de la première ligne qui doit simuler la taille de toutes les lignes présentes avant la ligne courante
                if (currentRowDisplay !== this.firstRowCreate) {
                    tableContentFragment.appendChild(this.simulateMultiRow(this.firstRowCreate));
                    this.firstRowCreate--;
                }

                for (; rowIndex < lastRowCreate; rowIndex++) {
                    //TODO errorMesage + bindEvents + class + cellClass
                    var row = this.gridModel.getRow(rowIndex),
                        tr = document.createElement('tr'),
                        columns = this.columnModel.getColumns(),
                        column, td, tdContentWrapper, colIdx, cell;
                    tr.classList.add('x-datagrid-tr');
                    for (colIdx = 0 ; colIdx < columns.length ; colIdx++) {
                        column = columns[colIdx];
                        td = document.createElement('td');
                        td.classList.add('x-datagrid-td');
                        if (column.width) {
                            td.style.width = column.width + 'px';
                        }
                        tdContentWrapper = document.createElement('div');
                        tdContentWrapper.className = 'x-datagrid-cell';
                        td.appendChild(tdContentWrapper);
                        cell = this.columnModel.getCell(row, column);
                        this.bindCellEvents(td, cell, row, column);
                        tr.appendChild(td);
                        column.renderer(tdContentWrapper, cell, row, column);
                    }
                    tableContentFragment.appendChild(tr);
                }

                // S'il y a plus de lignes que celles que l'on affiche
                if (lastRowCreate < length) {
                    var nbRowAfterCurrent = length - lastRowCreate;
                    tableContentFragment.appendChild(this.simulateMultiRow(nbRowAfterCurrent));
                    //et on en profite pour enlever la taille du scroll sur le tableau des colonnes headers
                }
                this.tableContent.innerHTML = '';

                this.tableContent.appendChild(tableContentFragment);

            },
            calculateHeaderWidth: function calculateHeaderWidth(nbSource) {
                this.columnHeaderWrapper.style.width = "100%";
                if (nbSource > this._nbRowDisplay) {
                    this.columnHeaderWrapper.style.width = (this.columnHeaderWrapper.offsetWidth - this.scrollBarWidth) + 'px';
                    this.columnHeaderWrapper.style.minWidth = (this.tableMinWidth - this.scrollBarWidth) + 'px';
                } else {
                    this.columnHeaderWrapper.style.minWidth = this.tableMinWidth + 'px';
                }
            },
            calculateMinimumWidth: function calculateMinimumWidth(cellMinWidth) {
                this.tableMinWidth = 0;
                var table = document.createElement("table");
                var trHeader = document.createElement("tr");
                var ths = [];
                this.columnModel.getColumns().forEach(function(colHeader) {
                    var tdHeader = document.createElement("th");
                    tdHeader.style.width = cellMinWidth + 'px';
                    if (colHeader.width) {
                        tdHeader.style.width = colHeader.width + 'px';
                    }
                    ths.push(tdHeader);
                    trHeader.appendChild(tdHeader);
                });
                table.appendChild(trHeader);
                document.body.appendChild(table);
                this.tableMinWidth = trHeader.offsetWidth;
                document.body.removeChild(table);
            },
            calculateContentSize: function calculateContentSize() {
                var contentWrapperHeight = this.offsetHeight - this.columnHeaderWrapper.offsetHeight;
                if (contentWrapperHeight <= 0) {
                    throw new Error("Wrong height calculated: " + contentWrapperHeight + "px. Explicitly set the height of the parent elements (consider position: absolute; top:0; bottom:0)");
                }

                var totalMinWidth = 0;
                this.columnModel.getColumns().forEach(function(colHeader) {
                    totalMinWidth +=  colHeader.width || this.cellMinWidth;
                }.bind(this));

                if (totalMinWidth > this.offsetWidth) {
                    contentWrapperHeight -= this.scrollBarWidth;
                } else {
                    this.contentWrapper.style.width = '100%';
                }
                this.contentWrapper.style.height = contentWrapperHeight + 'px';
                this.contentWrapper.style.minWidth = this.tableMinWidth + 'px';

                this._nbRowDisplay = Math.floor(contentWrapperHeight / this.rowHeight);
                this.cachedRow = this._nbRowDisplay * 2;
            },
            calculateCurrentLine: function getDisplayFirstLine(scrollTop) {
                var currentLine = Math.round(scrollTop / this.rowHeight);
                return  currentLine;
            },
            simulateMultiRow: function (nbRow) {
                var tr = document.createElement("tr");
                var td;
                this.columnModel.getColumns().forEach(function(colHeader) {
                    td = document.createElement("td");
                    if(colHeader.width) {
                        td.style.width = colHeader.width + "px";
                    }
                    tr.appendChild(td);
                });
                tr.style.height = (nbRow * this.rowHeight) + 'px';
                return tr;
            },
            getThColumnHeader: function getColumnHeaderTdWidth(colIndex) {
                return this.columnHeaderWrapper.querySelector("tr:nth-child(1) th:nth-child(" + colIndex + ")");
            },
            getCellAt: function getCellAt(xCoord, yCoord) {
                return this.contentWrapper.querySelector("table tr:nth-child("+(yCoord-this.firstRowCreate+1)+") td:nth-child(" + (xCoord+1) + ")");
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
        table.style.visibility = "hidden";
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
        if(trOffsetHeight === 0) {
            throw new Error('Erreur lors du calcul de la hauteur disponible pour une ligne');
        }
        return trOffsetHeight;
    }

})();

function DefaultDatagridModel(content) {
    this.content = content || [];
}
DefaultDatagridModel.prototype.getLength = function getLength() {
    return this.content.length;
};
DefaultDatagridModel.prototype.getRow = function(rowIndex) {
    return this.content[rowIndex];
};


function DefaultColumnModel(header) {
    this.columns = header.map(function(headerElt, index) {
        return new Column(headerElt, index);//TODO bouge dans le grid
    });
}
DefaultColumnModel.prototype.renderHeader = function(tr) {
    this.columns.forEach(function(col) {
        var th = document.createElement('th');
        if (col.width) { //TODO trouver une idée pour garder ça dans le datagrid
            th.style.width =  col.width + 'px';
        }
        th.innerHTML = '<div class="x-datagrid-cell">' + col.value + '</div>';
        tr.appendChild(th);
    });
};
DefaultColumnModel.prototype.getColumns = function() { //TODO bouge dans le grid ? euh ptet pas, ce serait à toi de savoir quelles sont les colonnes à afficher
    return this.columns;
};
DefaultColumnModel.prototype.getCell = function(row, column) { // euh...
    return row[column.index];
};



function Column(def, index) { //TODO permettre des attributs custo ??
    this.value = def.value; //TODO renommer en label ? ou objet complexe pour custo ?
    this.width = def.width;
    this.index = index;
    this.renderer = def.renderer || defaultRenderer;
}
function defaultRenderer(tdContentWrapper, cell, row, column) { //TODO ajouter la div avec sa superbe classe avant et la passer en paramètre ? à la place de la td ?
     //TODO add class ?
    if (cell.cellClass) { //TODO array ? c'est du default ça ?
        tdContentWrapper.parentNode.className += ' ' + cell.cellClass;
    }
    tdContentWrapper.innerHTML = cell.value === null ? '' : cell.value; //TODO dégager cell.value pour que cell soit la value directement ?
}

// cellClass utilisé pour le td
// class utilisé pour la div dans le td
function Cell(obj) { //FIXME pas utilisé dans cette implémentation !
    "use strict";
    this.value = obj.value || "";
    this.cellClass = obj.cellClass || ""; // default toi ? je crois plutôt que c'est juste value et events les attributs de base
    this.errorMessage = obj.errorMessage || ""; //ARGH vas-t-en dans un custom renderer vilain
    this.events = obj.events || null;
    if(obj.class && !Array.isArray(obj.class)) {
        throw new Error('class on cell is an array');
    }
    this.rowspan = obj.rowspan || 0; // ???
    this.colspan = obj.colspan || 0; // ???
    this.class = obj.class || []; //TODO A DEGAGER (utiliser cellClass)
    this.rowIndex = obj.rowIndex || null; //TODO A utiiser en remplacement du td.cellRow A DEGAGER ou à mettre direct dans les events
    this.columnIndex = obj.columnIndex || null; //TODO Non utilisé pour le moment A DEGAGER ou à mettre direct dans les events
}
module.exports = {
    Cell: Cell,
    Column: Column
};
