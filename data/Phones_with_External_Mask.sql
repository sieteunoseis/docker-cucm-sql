SELECT
  d.name,
  n.dnorpattern,
  dmap.numplanindex,
  dmap.e164mask
FROM
  device d
  INNER JOIN devicenumplanmap dmap ON dmap.fkdevice = d.pkid
  INNER JOIN numplan n ON dmap.fknumplan = n.pkid
WHERE
  dmap.e164mask = 'EXTERNAL MASK' -- Add your external mask here
ORDER BY
  d.name,
  dmap.numplanindex