SELECT
  n.dNOrPattern AS HuntPilot,
  d.name AS HuntList,
  d.description,
  rl.selectionorder,
  lg.name AS LineGroup
FROM
  device AS d
  INNER JOIN routelist AS rl ON rl.fkDevice = d.pkid
  INNER JOIN DeviceNumPlanMap AS dmap ON dmap.fkDevice = d.pkid
  INNER JOIN NumPlan AS n ON n.pkid = dmap.fkNumPlan
  INNER JOIN linegroup lg ON rl.fklinegroup = lg.pkid
ORDER BY
  n.dnorpattern