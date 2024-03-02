SELECT
  COUNT(n.dnorpattern),
  rp.name AS partition
FROM
  numplan AS n
  INNER JOIN routepartition AS rp ON n.fkroutepartition = rp.pkid
GROUP BY
  rp.name