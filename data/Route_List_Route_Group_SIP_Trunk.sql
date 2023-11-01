SELECT
  drl.name AS rl_name,
  drl.runonallnodes,
  rg.name AS rg_name,
  drg.name AS trunk_name
FROM
  routelist rl
  INNER JOIN device drl ON drl.pkid = rl.fkdevice
  LEFT OUTER JOIN routegroup rg ON rg.pkid = rl.fkroutegroup
  LEFT OUTER JOIN routegroupdevicemap rgdmap ON rgdmap.fkroutegroup = rg.pkid
  LEFT OUTER JOIN device drg ON rgdmap.fkdevice = drg.pkid
WHERE
  rl.fklinegroup IS NULL
ORDER BY
  drl.name,
  rl.selectionorder,
  rgdmap.deviceselectionorder