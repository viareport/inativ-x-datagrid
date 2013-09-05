module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compass');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-bumpup');
    grunt.loadNpmTasks('grunt-testem');

    // Project configuration.
    grunt.initConfig({
        
        clean: {
            main: ['dist/*.js', 'dist/*.css', 'testem*json']
        },
        compass: {
            main: {
                options: {
                    config: 'assets/compass_config.rb'
                }
            }
        },
        connect: {
            demo: {
                options:{
                    port: 3001,
                    keepalive: true,
                    hostname: '*'
                }
            }
        },
        copy: {
            main: {
                files: [
                    {src: ['src/main.js'], dest: 'dist/main.js'}
                ]
            }
        },
        jshint:{
            all: ['Gruntfile.js', 'src/main.js']
        },
        watch: {
            files: ['src/*.js', 'src/*.scss', 'test/test.js'],
            tasks: ['build'],
            options: {
                spawn: false
            }
        },
        browserify: {
            main: {
                files: {
                    'test/testbuild.js': ['test/test.js'],
                    'demo/main.js': ['src/main.js']
                }
            }
        },
        bumpup: ['package.json'],
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
        }
    });

    grunt.registerTask('launchDemo', function () {
        grunt.task.run('connect');
        grunt.log.writeln("----------");
        grunt.log.writeln(">>> demo ready, please visit http://localhost:3001/demo/");
        grunt.log.writeln("----------");
    });

    grunt.registerTask('build', ['clean', 'browserify', 'jshint', 'compass', 'copy']);
    grunt.registerTask('demo', ['build', 'launchDemo']);
    grunt.registerTask('test', ['build', 'testem']);
    grunt.registerTask('dist', ['test', 'bumpup']);

    grunt.registerTask('default', ['build', 'watch']);
};
