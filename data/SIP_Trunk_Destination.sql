SELECT
  d.name,
  dest.sortorder,
  dest.address,
  dest.port
FROM
  siptrunkdestination dest
  INNER JOIN sipdevice sd ON sd.pkid = dest.fksipdevice
  INNER JOIN device d ON d.pkid = sd.fkdevice
ORDER BY
  d.name,
  dest.sortorder