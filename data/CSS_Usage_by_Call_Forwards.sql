/*css distro for Forward Busy */
SELECT
  css.name,
  COUNT(n.dnorpattern) AS ipline
FROM
  callingsearchspace css
  INNER JOIN numplan AS n ON n.fkcallingsearchspace_cfb = css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_cfbint=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_cfna=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_cfnaint=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_cfur=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_cfurint=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_pff=css.pkid
  -- inner join numplan as n on n.fkcallingsearchspace_pffint=css.pkid
GROUP BY
  css.name