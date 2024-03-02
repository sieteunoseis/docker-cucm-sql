SELECT
  FIRST 5 n.dnorpattern,
  rp.name AS partition,
  d.name AS RouteList,
  rl.selectionOrder,
  rg.name AS RouteGroup,
  rgdp.DeviceSelectionOrder,
  dd.name AS gateway
FROM
  numplan AS n
  LEFT JOIN routepartition AS rp ON rp.pkid = n.fkroutepartition
  INNER JOIN devicenumplanmap AS dmap ON dmap.fknumplan = n.pkid
  INNER JOIN device AS d ON dmap.fkdevice = d.pkid
  LEFT JOIN routelist AS rl ON rl.fkdevice = d.pkid
  LEFT JOIN routegroup AS rg ON rg.pkid = rl.fkroutegroup
  INNER JOIN RouteGroupDeviceMap AS rgdp ON rgdp.fkRouteGroup = rg.pkid
  INNER JOIN device AS dd ON dd.pkid = rgdp.fkDevice
WHERE
  n.tkpatternusage = 5
ORDER BY
  n.dnorpattern,
  rl.selectionorder,
  rgdp.DeviceSelectionOrder