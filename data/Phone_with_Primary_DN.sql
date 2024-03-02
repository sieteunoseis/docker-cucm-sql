SELECT
  d.name AS Phone,
  d.description,
  n.dnorpattern AS PrimaryDN
FROM
  device d
  INNER JOIN devicenumplanmap dmap ON dmap.fkdevice = d.pkid
  INNER JOIN numplan n ON dmap.fknumplan = n.pkid
WHERE
  d.tkclass = 1
  AND dmap.numplanindex = 1
ORDER BY
  d.name