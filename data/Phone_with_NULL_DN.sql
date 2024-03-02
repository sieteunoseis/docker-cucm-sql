SELECT
  d.name AS Phone,
  d.description
FROM
  device d
WHERE
  d.tkclass = 1
  AND 1 > (
    SELECT
      COUNT(dmap.pkid)
    FROM
      devicenumplanmap dmap
    WHERE
      dmap.fkdevice = d.pkid
      AND dmap.numplanindex = 1
  )
ORDER BY
  d.name