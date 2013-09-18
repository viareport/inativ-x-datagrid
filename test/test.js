var TestSuite = require('spatester').TestSuite;
var rootSelector = "#datagrid";
var filterInputSelector = rootSelector + " x-inputfilter input";
var datagrid;

var testSuite = new TestSuite("Datagrid test", {
    setUp: function () {
        datagrid = document.createElement('x-datagrid');
        datagrid.setAttribute('id', "datagrid");
        datagrid.setAttribute('cell-height', 20);
        datagrid.setAttribute('cell-width', 100);
        datagrid.setAttribute('filter', false);

        document.querySelector('body').appendChild(datagrid);

        datagrid.data = {
            colHeader: [
                [
                    {value: 'column1', filter: true},
                    {value: 'column2'},
                    {value: 'column3'}
                ]
            ],
            content: [
                [
                    {value: "A1"},
                    {value: "B1"},
                    {value: "C1"}
                ],
                [
                    {value: "A2"},
                    {value: "B2"},
                    {value: "C2"}
                ],
                [
                    {value: "A3"},
                    {value: "B3"},
                    {value: "C3"}
                ]
            ]
        };
    },

    tearDown: function () {
        var datagrid = document.querySelector('x-datagrid');
        document.body.removeChild(datagrid);
    }
});

Testem.useCustomAdapter(function (socket) {
    testSuite.setSocket(socket);
});

testSuite.addTest("Affichage de la grille", function (scenario, asserter) {
    asserter.assertTrue(function () {
        return asserter.count("th")() === 3;
    }, "Le tableau doit contenir 3 column headers");

    asserter.assertTrue(function () {
        return asserter.count(".x-datagrid-td")() === 9;
    }, "Le tableau doit contenir 9 cellules de contenu");
});

testSuite.addTest("Application d'un filtre", function (scenario, asserter) {
    scenario
        .fill(filterInputSelector, 'A1')
        .keyboard(filterInputSelector, "keyup", "Enter", 13);

    asserter.assertTrue(function () {
        return asserter.count(".x-datagrid-td")() === 3;
    }, "Après filtre, le tableau doit contenir 3 cellules de contenu");
});

testSuite.addTest("Visualisation d'erreur dans la grille", function (scenario, asserter) {
    scenario.exec(function () {
        datagrid.content = [
            [
                {value: "A1", errorMessage: "ceci est un message d'erreur"},
                {value: "B1"},
                {value: "C1"}
            ],
            [
                {value: "A2"},
                {value: "B2"},
                {value: "C2"}
            ],
            [
                {value: "A3"},
                {value: "B3"},
                {value: "C3"}
            ]
        ];
    });

    asserter.assertTrue(function () {
        return document.querySelector(".error-message") !== null && asserter.count(".error-message")() === 1;
    }, "Le tableau doit contenir une zone d'erreur et seulement une");

    asserter.assertTrue(function () {
        return datagrid.tableContent.querySelector("tr:nth-child(1) td:nth-child(1) span.error-message") !== null;
    }, "La cellule de la ligne 1 et colonne 1 doit indiquer une erreur");
});

document.addEventListener('DOMComponentsLoaded', function () {
    testSuite.run();
});