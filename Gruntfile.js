module.exports = function (grunt) {

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-bumpup');
    grunt.loadNpmTasks('grunt-testem');
    grunt.loadNpmTasks('grunt-subgrunt');

    // Project configuration.
    grunt.initConfig({
        clean: {
            build: ['dist/*.js', 'dist/*.css'],
            test: ['test/testbuild.js', 'test/main.*', 'test/x-tag-core.js', 'testem*json'],
            demo: ['demo/*.js', 'demo/*.css']
        },
        compass: {
            main: {
                options: {
                    config: 'assets/compass_config.rb'
                }
            }
        },
        concat: {
            demo: {
                src: [
                    './node_modules/inativ-x-*/dist/*.css',
                    './dist/inativ-x.css'
                ],
                dest: 'build/main.css'
            },
            test: {
                src: [
                    './node_modules/*/dist/*.css',
                    './dist/inativ-x.css'
                ],
                dest: 'test/main.css'
            }
        },
        connect: {
            demo: {
                options: {
                    port: 3001,
                    keepalive: true,
                    hostname: '*'
                }
            }
        },
        copy: {
            dist: {
                files: [
                    {src: ['src/main.js'], dest: 'dist/main.js'},
                ]
            }
        },
        jshint: {
            all: ['src/main.js']
        },
        watch: {
            build: {
                files: ['src/*.js', 'src/*.scss', 'node_modules/inativ-*/dist/*.js', 'node_modules/inativ-*/dist/*.css'],
                tasks: ['build']
            },
            dev: {
                files: ['src/*.js', 'src/*.scss', 'node_modules/inativ-*/src/*.js', 'node_modules/inativ-*/src/*.scss'],
                tasks: ['dev']
            },
            test: {
                files: ['src/*.js', 'src/*.scss', 'test/test.js', 'test/TestemSuite.html'],
                tasks: ['test']
            },
            demo: {
                files: ['src/*.js', 'src/*.scss', 'demo/index.html'],
                tasks: ['watch_demo']
            },
            options: {
                spawn: false
            }
        },
        browserify: {
            test: {
                files: {
                    'test/main.js': ['lib/x-tag-core.js', 'src/main.js', 'test/test.js']
                }
            },
            demo: {
                files: {
                    'build/main.js': ['lib/x-tag-core.js', 'src/main.js']
                }
            }
        },
        bumpup: {
            options: {
                version: function (old, type) {
                    return old.replace(/([\d])+$/, grunt.option('wc-version'));
                }
            },
            file: 'package.json'
        },
        testem: {
            options: {
                'launch_in_ci': [
                    'firefox'
                ]
            },
            main: {
                src: [ 'test/TestemSuite.html' ],
                dest: 'test-result/testem-ci.tap'
            }
        },
        subgrunt: {
            target1: {
                options: {
                    npmClean: false,
                    npmInstall: false
                },
                projects: {
                    'node_modules/inativ-x-inputfilter': ['build']
                }
            }
        }
    });

    grunt.registerTask('launchDemo', function () {
        grunt.task.run('connect');
        grunt.log.writeln("----------");
        grunt.log.writeln(">>> demo ready, please visit http://localhost:3001/demo/");
        grunt.log.writeln("----------");
    });

    grunt.registerTask('build', ['clean:build', 'jshint', 'compass', 'copy:dist']);
    grunt.registerTask('build_test', ['build', 'clean:test', 'concat:test', 'browserify:test']);
    grunt.registerTask('build_demo', ['build', 'concat:demo', 'browserify:demo']);
    grunt.registerTask('watch_demo', ['build_demo', 'watch:demo']);
    grunt.registerTask('demo', ['build_demo', 'launchDemo']);
    grunt.registerTask('auto_test', ['build', 'build_test', 'testem']);
    grunt.registerTask('test', ['build', 'build_test', 'testem']);
    grunt.registerTask('dist', ['test', 'bumpup']);

    grunt.registerTask('dev', ['subgrunt', 'build', 'watch']);
    grunt.registerTask('default', ['build', 'watch:build']);
};
