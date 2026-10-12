/** Ground resolution of a web-mercator pixel, in meters. */
export function metersPerPixel(lat: number, zoom: number): number {
  const circumference = 40_075_016.686;
  return (circumference * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
}
