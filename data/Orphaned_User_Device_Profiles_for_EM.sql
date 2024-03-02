SELECT
  d.name
FROM
  device d
WHERE
  (
    0 = (
      SELECT
        COUNT(edm.pkid)
      FROM
        enduserdevicemap edm
      WHERE
        edm.fkdevice = d.pkid
    )
  )
  AND d.tkclass = 254
ORDER BY
  d.name