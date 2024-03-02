SELECT
  d.name,
  d.description,
  d.allowhotelingflag,
  d.tkclass
FROM
  device d
WHERE
  (
    (d.tkdeviceprofile != 3)
    AND (
      d.allowhotelingflag = 't'
      OR d.tkclass = 254
    )
    AND (
      0 = (
        SELECT
          COUNT(*)
        FROM
          device ddup
          INNER JOIN telecastersubscribedservice tss ON tss.fkdevice = ddup.pkid
        WHERE
          (
            ddup.pkid = d.pkid
            AND tss.servicename = 'Extension Mobility'
          )
      )
    )
  )
ORDER BY
  d.tkclass