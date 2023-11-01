SELECT
  dp.name AS name,
  cmg.name AS GROUP,
  dt.name AS datetime,
  r.name AS region,
  mrl.name AS mediaresourcelist,
  loc.name AS LOCATION,
  s.name AS srst
FROM
  devicepool dp
  LEFT JOIN callmanagergroup cmg ON dp.fkcallmanagergroup = cmg.pkid
  LEFT JOIN datetimesetting dt ON dp.fkdatetimesetting = dt.pkid
  LEFT JOIN region r ON dp.fkregion = r.pkid
  LEFT JOIN mediaresourcelist mrl ON dp.fkmediaresourcelist = mrl.pkid
  LEFT JOIN LOCATION loc ON dp.fklocation = loc.pkid
  LEFT JOIN srst s ON dp.fksrst = s.pkid
ORDER BY
  dp.name