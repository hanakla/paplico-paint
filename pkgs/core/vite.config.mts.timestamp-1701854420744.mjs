// vite.config.mts
import { defineConfig } from "file:///Users/hanak1a/ws/paplico-paint/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/hanak1a/ws/paplico-paint/pkgs/core/node_modules/vite-plugin-dts/dist/index.mjs";
import { externals } from "file:///Users/hanak1a/ws/paplico-paint/node_modules/rollup-plugin-node-externals/dist/index.js";
var __vite_injected_original_dirname = "/Users/hanak1a/ws/paplico-paint/pkgs/core";
var vite_config_default = defineConfig({
  define: {
    "import.meta.vitest": false
  },
  resolve: {
    alias: {
      crypto: "crypto-js",
      "@/": `${__vite_injected_original_dirname}/src/`
    }
  },
  build: {
    minify: process.env.BUILD_TARGET_ENV === "production",
    emptyOutDir: process.env.BUILD_TARGET_ENV === "production",
    lib: {
      entry: {
        index: "src/index.ts",
        "expr-webgl": "src/index-expr-webgl.ts",
        "ext-brush": "src/index-ext-brush.ts",
        "ext-ink": "src/index-ext-ink.ts",
        "ext-filter": "src/index-ext-filter.ts",
        "math-utils": "src/index-math-utils.ts",
        extras: "src/index-extras.ts"
      },
      name: "PapCore",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        console.log(entryName);
        return `${entryName}.${format === "es" ? "mjs" : "js"}`;
      }
    },
    rollupOptions: {
      output: {
        exports: "auto"
      }
    }
  },
  plugins: [
    {
      enforce: "pre",
      ...externals({
        builtins: false,
        exclude: [
          "mitt",
          "three",
          "abs-svg-path",
          "is-ios",
          "fast-random"
        ]
      })
    },
    dts({
      rollupTypes: false
    })
  ],
  test: {
    globals: true,
    includeSource: ["src/**/*{.spec.ts,.ts}"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL1VzZXJzL2hhbmFrMWEvd3MvcGFwbGljby1wYWludC9wa2dzL2NvcmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9oYW5hazFhL3dzL3BhcGxpY28tcGFpbnQvcGtncy9jb3JlL3ZpdGUuY29uZmlnLm10c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvaGFuYWsxYS93cy9wYXBsaWNvLXBhaW50L3BrZ3MvY29yZS92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgdHlwZSB7fSBmcm9tICd2aXRlc3QvY29uZmlnJ1xuXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IGR0cyBmcm9tICd2aXRlLXBsdWdpbi1kdHMnXG5pbXBvcnQgeyBleHRlcm5hbHMgfSBmcm9tICdyb2xsdXAtcGx1Z2luLW5vZGUtZXh0ZXJuYWxzJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBkZWZpbmU6IHtcbiAgICAnaW1wb3J0Lm1ldGEudml0ZXN0JzogZmFsc2UsXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgY3J5cHRvOiAnY3J5cHRvLWpzJyxcbiAgICAgICdALyc6IGAke19fZGlybmFtZX0vc3JjL2AsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBtaW5pZnk6IHByb2Nlc3MuZW52LkJVSUxEX1RBUkdFVF9FTlYgPT09ICdwcm9kdWN0aW9uJyxcbiAgICBlbXB0eU91dERpcjogcHJvY2Vzcy5lbnYuQlVJTERfVEFSR0VUX0VOViA9PT0gJ3Byb2R1Y3Rpb24nLFxuICAgIGxpYjoge1xuICAgICAgZW50cnk6IHtcbiAgICAgICAgaW5kZXg6ICdzcmMvaW5kZXgudHMnLFxuICAgICAgICAnZXhwci13ZWJnbCc6ICdzcmMvaW5kZXgtZXhwci13ZWJnbC50cycsXG4gICAgICAgICdleHQtYnJ1c2gnOiAnc3JjL2luZGV4LWV4dC1icnVzaC50cycsXG4gICAgICAgICdleHQtaW5rJzogJ3NyYy9pbmRleC1leHQtaW5rLnRzJyxcbiAgICAgICAgJ2V4dC1maWx0ZXInOiAnc3JjL2luZGV4LWV4dC1maWx0ZXIudHMnLFxuICAgICAgICAnbWF0aC11dGlscyc6ICdzcmMvaW5kZXgtbWF0aC11dGlscy50cycsXG4gICAgICAgIGV4dHJhczogJ3NyYy9pbmRleC1leHRyYXMudHMnLFxuICAgICAgfSxcbiAgICAgIG5hbWU6ICdQYXBDb3JlJyxcbiAgICAgIGZvcm1hdHM6IFsnZXMnLCAnY2pzJ10sXG4gICAgICBmaWxlTmFtZTogKGZvcm1hdCwgZW50cnlOYW1lKSA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGVudHJ5TmFtZSlcbiAgICAgICAgcmV0dXJuIGAke2VudHJ5TmFtZX0uJHtmb3JtYXQgPT09ICdlcycgPyAnbWpzJyA6ICdqcyd9YFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBleHBvcnRzOiAnYXV0bycsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICB7XG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIC4uLmV4dGVybmFscyh7XG4gICAgICAgIGJ1aWx0aW5zOiBmYWxzZSxcbiAgICAgICAgZXhjbHVkZTogW1xuICAgICAgICAgICdtaXR0JyxcbiAgICAgICAgICAndGhyZWUnLFxuICAgICAgICAgICdhYnMtc3ZnLXBhdGgnLFxuICAgICAgICAgICdpcy1pb3MnLFxuICAgICAgICAgICdmYXN0LXJhbmRvbScsXG4gICAgICAgICAgLy8gJ0BwYXBsaWNvL3NoYXJlZC1saWInLFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgfSBhcyBhbnksXG4gICAgZHRzKHtcbiAgICAgIHJvbGx1cFR5cGVzOiBmYWxzZSxcbiAgICB9KSxcbiAgXSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgaW5jbHVkZVNvdXJjZTogWydzcmMvKiovKnsuc3BlYy50cywudHN9J10sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVBLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sU0FBUztBQUNoQixTQUFTLGlCQUFpQjtBQUoxQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRO0FBQUEsSUFDTixzQkFBc0I7QUFBQSxFQUN4QjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTSxHQUFHO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVEsUUFBUSxJQUFJLHFCQUFxQjtBQUFBLElBQ3pDLGFBQWEsUUFBUSxJQUFJLHFCQUFxQjtBQUFBLElBQzlDLEtBQUs7QUFBQSxNQUNILE9BQU87QUFBQSxRQUNMLE9BQU87QUFBQSxRQUNQLGNBQWM7QUFBQSxRQUNkLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLGNBQWM7QUFBQSxRQUNkLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixTQUFTLENBQUMsTUFBTSxLQUFLO0FBQUEsTUFDckIsVUFBVSxDQUFDLFFBQVEsY0FBYztBQUMvQixnQkFBUSxJQUFJLFNBQVM7QUFDckIsZUFBTyxHQUFHLGFBQWEsV0FBVyxPQUFPLFFBQVE7QUFBQSxNQUNuRDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLFNBQVM7QUFBQSxNQUNYO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQO0FBQUEsTUFDRSxTQUFTO0FBQUEsTUFDVCxHQUFHLFVBQVU7QUFBQSxRQUNYLFVBQVU7QUFBQSxRQUNWLFNBQVM7QUFBQSxVQUNQO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBRUY7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxJQUFJO0FBQUEsTUFDRixhQUFhO0FBQUEsSUFDZixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsZUFBZSxDQUFDLHdCQUF3QjtBQUFBLEVBQzFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
