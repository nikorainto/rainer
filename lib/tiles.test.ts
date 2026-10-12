import assert from "node:assert/strict";
import test from "node:test";
import { isRadarFramePath, radarTileUrl, rainViewerOrigin } from "./tiles";

test("only https RainViewer origins are accepted", () => {
  assert.equal(
    rainViewerOrigin("https://tilecache.rainviewer.com"),
    "https://tilecache.rainviewer.com",
  );
  assert.equal(
    rainViewerOrigin("https://tilecache.rainviewer.com/"),
    "https://tilecache.rainviewer.com",
  );
  assert.equal(rainViewerOrigin("https://rainviewer.com"), "https://rainviewer.com");
  assert.equal(rainViewerOrigin("http://tilecache.rainviewer.com"), null);
  assert.equal(rainViewerOrigin("https://evilrainviewer.com"), null);
  assert.equal(rainViewerOrigin("https://tilecache.rainviewer.com.evil.com"), null);
  assert.equal(rainViewerOrigin("https://user:pass@tilecache.rainviewer.com"), null);
  assert.equal(rainViewerOrigin("https://tilecache.rainviewer.com:444"), null);
  assert.equal(rainViewerOrigin("https://tilecache.rainviewer.com/extra"), null);
  assert.equal(rainViewerOrigin("https://tilecache.rainviewer.com/?x=1"), null);
  assert.equal(rainViewerOrigin("not a url"), null);
});

test("frame paths stay inside the radar prefix", () => {
  assert.equal(isRadarFramePath("/v2/radar/abc_DEF-1"), true);
  assert.equal(isRadarFramePath("/v2/radar/../secret"), false);
  assert.equal(isRadarFramePath("/v2/radar/a/b"), false);
  assert.equal(isRadarFramePath("https://tilecache.rainviewer.com/v2/radar/a"), false);
});

test("map tiles are built only from an allowed host and path", () => {
  assert.equal(
    radarTileUrl("https://tilecache.rainviewer.com", "/v2/radar/abc"),
    "https://tilecache.rainviewer.com/v2/radar/abc/256/{z}/{x}/{y}/2/1_1.png",
  );
  assert.equal(radarTileUrl("https://evilrainviewer.com", "/v2/radar/abc"), null);
  assert.equal(radarTileUrl("https://tilecache.rainviewer.com", "/etc/passwd"), null);
});
