SELECT
  lg.name AS LineGroup,
  tda.name AS Algorithm,
  lgmap.lineSelectionOrder AS ORDER,
  n.dnorpattern AS DN,
  d.name AS Station
FROM
  linegroup lg
  INNER JOIN typedistributealgorithm tda ON lg.tkdistributealgorithm = tda.enum
  INNER JOIN linegroupnumplanmap lgmap ON lgmap.fklinegroup = lg.pkid
  INNER JOIN numplan n ON lgmap.fknumplan = n.pkid
  INNER JOIN devicenumplanmap AS dmap ON dmap.fknumplan = n.pkid
  INNER JOIN device d ON dmap.fkdevice = d.pkid
ORDER BY
  lg.name,
  lgmap.lineSelectionOrder